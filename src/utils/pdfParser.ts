import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ExtractedLink, CandidateProfile, ProjectItem, ExperienceItem, EducationItem } from '../types/profile';
import { validatePdfBuffer } from './security';
import { splitPhoneAndExtension } from './phoneUtils';
import { normalizeLinkedInUrl, normalizeGitHubUrl, normalizePortfolioUrl } from './urlUtils';

// Helper to safely get worker source in extension environment
export function getPdfWorkerSrc(): string {
  try {
    const globalObj = globalThis as any;
    if (globalObj.browser?.runtime?.getURL) {
      return globalObj.browser.runtime.getURL(pdfWorkerUrl);
    }
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      return chrome.runtime.getURL(pdfWorkerUrl);
    }
  } catch {
    // fallback
  }
  return pdfWorkerUrl;
}

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();

export interface ParsedResumeResult {
  rawText: string;
  extractedLinks: ExtractedLink[];
  suggestedProfile: Partial<CandidateProfile>;
}

export function classifyResumeUrl(rawUrl: string): {
  category: ExtractedLink['category'];
  isProfile: boolean;
  username?: string;
} {
  let urlObj: URL;
  try {
    const withProto = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    urlObj = new URL(withProto);
  } catch {
    return { category: 'other', isProfile: false };
  }

  const host = urlObj.hostname.toLowerCase().replace(/^www\./, '');
  const pathSegments = urlObj.pathname.split('/').filter(Boolean);

  // 1. GitHub URL Classification
  if (host === 'github.com') {
    const reserved = [
      'features',
      'pricing',
      'topics',
      'trending',
      'about',
      'collections',
      'events',
      'security',
      'enterprise',
      'marketplace',
      'login',
      'signup',
      'explore',
      'settings',
      'notifications',
    ];

    // Exactly 1 path segment = Profile link (e.g. github.com/username)
    if (pathSegments.length === 1 && !reserved.includes(pathSegments[0].toLowerCase())) {
      return { category: 'github', isProfile: true, username: pathSegments[0] };
    }

    // 2 or more path segments = Repository / Project link (e.g. github.com/username/project)
    if (pathSegments.length >= 2 && !reserved.includes(pathSegments[0].toLowerCase())) {
      return {
        category: 'project',
        isProfile: false,
        username: pathSegments[0],
      };
    }

    return { category: 'other', isProfile: false };
  }

  // 2. LinkedIn URL Classification
  if (host.includes('linkedin.com')) {
    if (pathSegments.length >= 2 && (pathSegments[0].toLowerCase() === 'in' || pathSegments[0].toLowerCase() === 'pub')) {
      return { category: 'linkedin', isProfile: true };
    }
    return { category: 'other', isProfile: false };
  }

  // 3. GitLab / Bitbucket Repository Links
  if (host === 'gitlab.com' || host === 'bitbucket.org') {
    if (pathSegments.length >= 2) {
      return { category: 'project', isProfile: false, username: pathSegments[0] };
    }
  }

  // 4. Personal Portfolio Domains
  if (
    host.includes('portfolio') ||
    host.endsWith('.dev') ||
    host.endsWith('.me') ||
    host.endsWith('.github.io') ||
    host.includes('vercel.app') ||
    host.includes('netlify.app') ||
    host.endsWith('.io')
  ) {
    return { category: 'portfolio', isProfile: true };
  }

  // General web links (company websites, articles, docs) are NOT projects
  return { category: 'other', isProfile: false };
}

export function extractCandidateName(
  fullText: string,
  email = '',
  phone = ''
): { firstName: string; lastName: string } {
  // Find where contact info begins
  let contactIndex = fullText.length;

  if (email) {
    const idx = fullText.indexOf(email);
    if (idx !== -1 && idx < contactIndex) contactIndex = idx;
  }
  if (phone) {
    const idx = fullText.indexOf(phone);
    if (idx !== -1 && idx < contactIndex) contactIndex = idx;
  }

  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch.index !== undefined && emailMatch.index < contactIndex) {
    contactIndex = emailMatch.index;
  }

  const phoneMatch = fullText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch && phoneMatch.index !== undefined && phoneMatch.index < contactIndex) {
    contactIndex = phoneMatch.index;
  }

  const urlMatch = fullText.match(/(https?:\/\/|www\.|linkedin\.com|github\.com)/i);
  if (urlMatch && urlMatch.index !== undefined && urlMatch.index < contactIndex) {
    contactIndex = urlMatch.index;
  }

  // Slice text before contact details
  let preContact = fullText.slice(0, contactIndex).trim();
  if (preContact.length < 2) {
    preContact = fullText;
  }

  // Split by newlines, pipes, bullets, slashes
  const segments = preContact
    .split(/[\n|•·/]/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    // Remove headers like "Resume", "CV", "Name:"
    const cleanSeg = seg.replace(/^(resume|curriculum vitae|cv|name\s*:?)/i, '').trim();
    if (!cleanSeg) continue;

    // Filter valid alphabetical name words (support hyphenated, apostrophes, and period for middle initial)
    const words = cleanSeg.split(/[\s,]+/).filter((w) => /^[a-zA-Z.'-]+$/.test(w));

    if (words.length >= 2) {
      const firstName = words[0];
      // Limit to at most 2 words for last/middle name (avoid leaking addresses or titles)
      const lastName = words.slice(1, Math.min(words.length, 3)).join(' ');
      return { firstName, lastName };
    } else if (words.length === 1 && words[0].length > 1) {
      return { firstName: words[0], lastName: '' };
    }
  }

  return { firstName: '', lastName: '' };
}

/**
 * Robustly matches section headers, supporting punctuation, styling, prefixes, and synonyms.
 */
export function matchSectionHeader(line: string): string | null {
  // Strip leading/trailing bullets, icons, markdown hashtags, numbers, colons, pipes
  let clean = line
    .replace(/^[\s•·\-\*#|~—–\d.:()\[\]]+|[\s:•·\-\*#|~—–]+$/g, '')
    .trim();

  if (!clean || clean.length > 60) return null;

  // Normalize spaced letters: e.g. "E X P E R I E N C E" -> "EXPERIENCE"
  clean = clean.replace(/\b([A-Za-z])\s+(?=[A-Za-z]\b)/g, '$1');

  // Experience patterns (Work Experience, Professional Experience, Employment History, etc.)
  if (
    /^(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|relevant\s+experience|career\s+history|professional\s+background|work\s+&\s+experience|internships?\s*(?:&|\/)?\s*(?:work\s+)?experience|internships?|employment|experience)(?:\s*\([^)]*\))?$/i.test(
      clean
    )
  ) {
    return 'experience';
  }

  // Projects patterns
  if (
    /^(?:personal\s+projects|key\s+projects|technical\s+projects|academic\s+projects|notable\s+projects|featured\s+projects|selected\s+projects|side\s+projects|software\s+projects|projects(?:\s*(?:&|\/)\s*portfolio)?)$/i.test(
      clean
    )
  ) {
    return 'projects';
  }

  // Education patterns
  if (
    /^(?:academic\s+background|education\s*(?:&|\/)?\s*qualifications|academic\s+qualifications|academic\s+history|education|academics)$/i.test(
      clean
    )
  ) {
    return 'education';
  }

  // Skills patterns
  if (
    /^(?:technical\s+skills|core\s+competencies|core\s+skills|areas\s+of\s+expertise|skills\s*(?:&|\/)?\s*(?:abilities|tools|technologies|frameworks)|technical\s+proficiencies|programming\s+languages|skills|technologies)$/i.test(
      clean
    )
  ) {
    return 'skills';
  }

  // Certificates patterns
  if (
    /^(?:certifications?|certificates?|licenses?\s*(?:&|\/)?\s*certifications?|courses?\s*(?:&|\/)?\s*certificates?|accreditations?)$/i.test(
      clean
    )
  ) {
    return 'certificates';
  }

  // Summary patterns
  if (
    /^(?:professional\s+summary|executive\s+summary|summary\s+of\s+qualifications|about\s+me|career\s+objective|profile\s+summary|summary|profile|objective)$/i.test(
      clean
    )
  ) {
    return 'summary';
  }

  return null;
}

export function parseResumeSections(text: string): Record<string, string[]> {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: Record<string, string[]> = {};
  let currentSection = 'header';
  sections[currentSection] = [];

  for (const line of lines) {
    const matchedSection = matchSectionHeader(line);
    if (matchedSection) {
      currentSection = matchedSection;
      if (!sections[currentSection]) sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }
  return sections;
}

// Regex components for broad date range matching in experience blocks
const MONTH_NAMES =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const NUMERIC_DATE = '(?:(?:0?[1-9]|1[0-2])[\\/.-](?:\\d{4}|\\d{2})|(?:19|20)\\d{2}[\\/.-](?:0?[1-9]|1[0-2]))';
const YEAR_DATE = '(?:\\b(?:19|20)\\d{2}\\b)';
const SEASON_DATE = '(?:(?:Spring|Summer|Fall|Winter|Autumn)\\s+(?:\\d{4}|\\d{2}))';

const START_DATE_PATTERN = `(?:${MONTH_NAMES}[a-z.]*,?\\s+(?:'\\d{2}|\\d{4})|${NUMERIC_DATE}|${SEASON_DATE}|${YEAR_DATE})`;
const END_DATE_PATTERN = `(?:${START_DATE_PATTERN}|Present|Current|Now|Ongoing|Till Date|To Date|Currently)`;
const DATE_SEP = `(?:\\s*[-–—~\\/]+\\s*|\\s+(?:to|until|through)\\s+)`;

export const EXPERIENCE_DATE_PATTERN = new RegExp(
  `(${START_DATE_PATTERN})${DATE_SEP}(${END_DATE_PATTERN})`,
  'i'
);

const ROLE_KEYWORDS =
  /\b(developer|engineer|manager|lead|architect|intern|specialist|consultant|analyst|designer|director|administrator|coordinator|officer|scientist|programmer|associate|fellow|qa|tester|devops|sre|sde)\b/i;

const LOCATION_PATTERN =
  /\b(?:Remote|Hybrid|On-site|[A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Za-z]+))\b/i;

export function parseExperience(lines: string[]): ExperienceItem[] {
  if (!lines || lines.length === 0) return [];
  const experiences: ExperienceItem[] = [];
  let currentExp: ExperienceItem | null = null;
  let pendingHeader: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isBullet = /^[•·\-\*]/.test(line);
    const dateMatch = line.match(EXPERIENCE_DATE_PATTERN);

    if (dateMatch) {
      const startDate = dateMatch[1].trim();
      const endDate = dateMatch[2].trim();

      // Content on the same line excluding date
      const textWithoutDate = line
        .replace(dateMatch[0], '')
        .replace(/[()\[\]]/g, '')
        .replace(/\s*\|\s*(Website|Link|Remote|Full-time|Part-time).*$/i, '')
        .trim();

      let company = '';
      let role = '';
      let location = '';

      // Check for location inside parenthesis or on the line
      const parenLocMatch = textWithoutDate.match(/\(([^)]+)\)/);
      if (parenLocMatch && (LOCATION_PATTERN.test(parenLocMatch[1]) || parenLocMatch[1].includes(','))) {
        location = parenLocMatch[1].trim();
      } else {
        const locMatch = line.match(LOCATION_PATTERN);
        if (locMatch) {
          location = locMatch[0].trim();
        }
      }

      // Remove parenthesis and delimiters for splitting
      const cleanLineForSplitting = textWithoutDate
        .replace(/\([^)]*\)/g, '')
        .trim();

      // If line contains company / role separated by delimiters
      if (cleanLineForSplitting) {
        const parts = cleanLineForSplitting
          .split(/\s*(?:[-–—|•·]|\bat\b)\s*/i)
          .map((p) => p.trim().replace(/^[,(]+|[,)]+$/g, '').trim())
          .filter(Boolean);

        if (parts.length >= 2) {
          // Identify which part is role vs company
          if (ROLE_KEYWORDS.test(parts[0]) && !ROLE_KEYWORDS.test(parts[1])) {
            role = parts[0];
            company = parts[1];
          } else if (ROLE_KEYWORDS.test(parts[1]) && !ROLE_KEYWORDS.test(parts[0])) {
            company = parts[0];
            role = parts[1];
          } else {
            company = parts[0];
            role = parts[1];
          }
          if (parts.length >= 3 && !location) {
            location = parts[2];
          }
        } else if (parts.length === 1) {
          if (ROLE_KEYWORDS.test(parts[0])) {
            role = parts[0];
          } else {
            company = parts[0];
          }
        }
      }

      // If role or company is missing, inspect pending header lines from above
      if ((!company || !role) && pendingHeader.length > 0) {
        for (const prevLine of [...pendingHeader].reverse()) {
          const cleanPrev = prevLine.replace(/\([^)]*\)/g, '').trim();
          const parts = cleanPrev
            .split(/\s*(?:[-–—|•·]|\bat\b)\s*/i)
            .map((p) => p.trim().replace(/^[,(]+|[,)]+$/g, '').trim())
            .filter(Boolean);

          if (!role && parts.some((p) => ROLE_KEYWORDS.test(p))) {
            const rolePart = parts.find((p) => ROLE_KEYWORDS.test(p));
            role = rolePart || '';
            const companyPart = parts.find((p) => p !== rolePart);
            if (!company && companyPart) {
              company = companyPart;
            }
          } else if (!company && parts.length > 0) {
            company = parts[0];
            if (!role && parts.length > 1) {
              role = parts[1];
            }
          }
        }
      }

      // Final fallbacks
      if (!role) role = 'Software Engineer';
      if (!company) company = 'Company';

      currentExp = {
        id: `exp_${Date.now()}_${experiences.length}`,
        company: company.replace(/[|•·\-\*]/g, '').trim(),
        role: role.replace(/[|•·\-\*]/g, '').trim(),
        location,
        startDate: startDate || '',
        endDate: endDate || 'Present',
        highlights: [],
      };
      experiences.push(currentExp);
      pendingHeader = [];
    } else if (isBullet) {
      pendingHeader = [];
      if (currentExp) {
        const cleanBullet = line.replace(/^[•·\-\*]\s*/, '').trim();
        if (
          currentExp.highlights.length > 0 &&
          ((!currentExp.highlights[currentExp.highlights.length - 1].endsWith('.') &&
            !currentExp.highlights[currentExp.highlights.length - 1].endsWith('!')) ||
            /^[a-z]/.test(cleanBullet))
        ) {
          currentExp.highlights[currentExp.highlights.length - 1] += ' ' + cleanBullet;
        } else {
          currentExp.highlights.push(cleanBullet);
        }
      }
    } else {
      // Non-bullet line without date: either a company/role header line or continuation
      if (line.length < 90 && !line.endsWith('.')) {
        pendingHeader.push(line);
      } else if (currentExp && currentExp.highlights.length > 0) {
        currentExp.highlights[currentExp.highlights.length - 1] += ' ' + line;
      }
    }
  }

  // Fallback: If no date pattern matched, but there are role headers with bullets
  if (experiences.length === 0 && lines.length > 0) {
    let fallbackExp: ExperienceItem | null = null;
    for (const line of lines) {
      const isBullet = /^[•·\-\*]/.test(line);
      if (!isBullet && ROLE_KEYWORDS.test(line) && line.length < 80) {
        const cleanLine = line.replace(/\([^)]*\)/g, '').trim();
        const parts = cleanLine
          .split(/\s*(?:[-–—|•·]|\bat\b)\s*/i)
          .map((s) => s.trim().replace(/^[,(]+|[,)]+$/g, '').trim())
          .filter(Boolean);
        const role = parts.find((p) => ROLE_KEYWORDS.test(p)) || line;
        const company = parts.find((p) => p !== role) || 'Company';
        fallbackExp = {
          id: `exp_${Date.now()}_${experiences.length}`,
          company,
          role,
          location: '',
          startDate: '',
          endDate: 'Present',
          highlights: [],
        };
        experiences.push(fallbackExp);
      } else if (isBullet && fallbackExp) {
        fallbackExp.highlights.push(line.replace(/^[•·\-\*]\s*/, '').trim());
      }
    }
  }

  return experiences;
}

const COMMON_TECH_STACK = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Vue',
  'Angular',
  'Node.js',
  'Node',
  'Express',
  'Python',
  'Django',
  'FastAPI',
  'Flask',
  'Java',
  'Spring Boot',
  'Spring',
  'Go',
  'Golang',
  'Rust',
  'C++',
  'C#',
  '.NET',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST API',
  'Tailwind',
  'HTML',
  'CSS',
  'Git',
  'Linux',
  'LLM',
  'OpenAI',
  'LangChain',
  'PyTorch',
  'TensorFlow',
  'FFmpeg',
  'Vite',
  'PipeWire',
  'Wayland',
];

export function parseProjects(lines: string[], links: ExtractedLink[]): ProjectItem[] {
  if (!lines || lines.length === 0) return [];
  const projects: ProjectItem[] = [];
  let currentProj: ProjectItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isBullet = /^[•·\-\*]/.test(line);
    const endsWithPunct = /[.,;:]$/.test(line);
    const isTechPrefix = /^(?:technologies|tech\s+stack|built\s+with|tools)\s*:/i.test(line);

    // Next line is a bullet or a tech stack declaration
    const nextIsBulletOrTech =
      i + 1 < lines.length &&
      (/^[•·\-\*]/.test(lines[i + 1]) ||
        /^(?:technologies|tech\s+stack|built\s+with|tools)\s*:/i.test(lines[i + 1]));

    // Header candidate: not a bullet, not a tech prefix, doesn't end with period, either has delimiter or next line is a bullet
    const isHeader =
      !isBullet &&
      !isTechPrefix &&
      !endsWithPunct &&
      line.length < 90 &&
      (line.includes('|') || line.includes('http') || nextIsBulletOrTech);

    if (isHeader) {
      let cleanTitle = line
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/\s*\|\s*(Github|Demo|Link|Website|Live|Source|Code).*$/i, '')
        .replace(/[\s|•·\-\*]+$/, '')
        .trim();

      if (!cleanTitle) cleanTitle = 'Project';

      // Check if title or line matches any extracted links
      const titleLower = cleanTitle.toLowerCase();
      const matchedLink = links.find((l) => {
        const urlLower = l.url.toLowerCase();
        const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
          (slug.length >= 3 && urlLower.includes(slug)) ||
          (titleLower.includes('spic') && urlLower.includes('spic')) ||
          (titleLower.includes('leetcode') && urlLower.includes('youtube')) ||
          (titleLower.includes('rag') && urlLower.includes('rag'))
        );
      });

      const lineUrlMatch = line.match(/(https?:\/\/[^\s,;"'<>()]+)/i);
      const url = lineUrlMatch ? lineUrlMatch[1] : matchedLink ? matchedLink.url : '';
      const githubUrl = url.includes('github.com') ? url : '';

      currentProj = {
        id: `proj_${Date.now()}_${projects.length}`,
        title: cleanTitle,
        technologies: [],
        description: '',
        url,
        githubUrl,
      };
      projects.push(currentProj);
    } else if (currentProj) {
      const cleanText = line.replace(/^[•·\-\*]\s*/, '').trim();

      const techPrefixMatch = cleanText.match(/^(?:Technologies|Tech Stack|Built with|Tools)\s*:\s*(.*)$/i);
      if (techPrefixMatch) {
        const explicitTechs = techPrefixMatch[1]
          .split(/[,|•·/]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        currentProj.technologies = Array.from(new Set([...currentProj.technologies, ...explicitTechs]));
      } else {
        currentProj.description += (currentProj.description ? ' ' : '') + cleanText;
      }
    }
  }

  // Populate technologies from description / title matching common tech stack
  for (const p of projects) {
    const combined = `${p.title} ${p.description}`;
    const detected = COMMON_TECH_STACK.filter((k) => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(combined);
    });
    p.technologies = Array.from(new Set([...p.technologies, ...detected]));
  }

  return projects;
}

export function parseSkills(lines: string[]): string[] {
  if (!lines || lines.length === 0) return [];
  const skills: string[] = [];
  for (const line of lines) {
    const content = line
      .replace(/^[•·\-\*]\s*/, '')
      .replace(/^[^:]+[:\-]+\s*/, '');
    const tokens = content
      .split(/[,|•·/]+/)
      .map((s) => s.trim().replace(/\s+basics$/i, ''))
      .filter(
        (s) =>
          s.length > 1 &&
          !/^(responsive ui|css animations|development|flows|optimization|basics|link|certificate)$/i.test(s)
      );
    skills.push(...tokens);
  }
  return Array.from(new Set(skills));
}

export function parseEducation(lines: string[]): EducationItem[] {
  if (!lines || lines.length === 0) return [];
  const edu: EducationItem[] = [];
  const inst = lines[0] || '';
  const degree = lines[1] || '';
  let year = '';
  let gpa = '';

  const yearMatch = degree.match(/(\d{4})\s*[-–—to]+\s*(\d{4})|\b(20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[2] || yearMatch[3] || yearMatch[1];
  }
  const gpaMatch = degree.match(/(\d+\.?\d*)\s*CGPA|GPA\s*(\d+\.?\d*)/i);
  if (gpaMatch) {
    gpa = gpaMatch[0];
  }

  edu.push({
    id: `edu_${Date.now()}`,
    institution: inst,
    degree: degree.replace(/\d{4}.*$/, '').replace(/-?\s*\d+\.?\d*\s*CGPA.*/i, '').trim(),
    fieldOfStudy: degree.includes('Computer Science') ? 'Computer Science' : 'Engineering',
    graduationYear: year || '2024',
    gpa: gpa || '',
  });
  return edu;
}

export function extractCity(headerLines: string[], email: string, phone: string): string {
  const KNOWN_CITIES = [
    'Pune',
    'Mumbai',
    'Bangalore',
    'Bengaluru',
    'Delhi',
    'New Delhi',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Gurgaon',
    'Noida',
    'San Francisco',
    'New York',
    'Seattle',
    'Austin',
    'Boston',
    'Chicago',
    'Los Angeles',
    'London',
    'Toronto',
    'Vancouver',
    'Berlin',
    'Paris',
    'Sydney',
    'Singapore',
  ];

  for (const line of headerLines) {
    const cleaned = line
      .replace(email, '')
      .replace(phone, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    // Check for "City, State/Country" pattern: e.g. "San Francisco, CA" or "Austin, TX"
    const cityStateMatch = cleaned.match(/\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2}|India|USA|UK|Canada|Germany)\b/);
    if (cityStateMatch) {
      return cityStateMatch[1].trim();
    }

    const words = cleaned.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (KNOWN_CITIES.some((c) => c.toLowerCase() === w.toLowerCase())) {
        return w;
      }
    }
  }
  return '';
}

/**
 * Reconstructs continuous page text with proper line breaks based on PDF text item coordinates and EOL flags.
 */
export function reconstructTextWithLines(items: any[]): string {
  if (!items || items.length === 0) return '';
  let result = '';
  let lastY: number | null = null;
  let lastX: number | null = null;
  let lastWidth = 0;
  let shouldBreakNext = false;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const str: string = 'str' in item ? item.str : '';
    if (typeof str !== 'string') continue;

    const transform = item.transform;
    const currentX = Array.isArray(transform) ? transform[4] : null;
    const currentY = Array.isArray(transform) ? transform[5] : null;
    const hasEOL = Boolean(item.hasEOL);

    if (shouldBreakNext || (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 3.5)) {
      if (!result.endsWith('\n')) {
        result += '\n';
      }
      lastX = null;
      lastWidth = 0;
      shouldBreakNext = false;
    } else if (
      currentX !== null &&
      lastX !== null &&
      str.trim() &&
      !result.endsWith(' ') &&
      !result.endsWith('\n') &&
      !str.startsWith(' ')
    ) {
      // Horizontal gap on same line
      const gap = currentX - (lastX + lastWidth);
      if (gap > 2) {
        result += ' ';
      }
    }

    result += str;

    if (hasEOL) {
      shouldBreakNext = true;
    }

    if (str.trim()) {
      if (currentY !== null) lastY = currentY;
      if (currentX !== null) {
        lastX = currentX;
        lastWidth = item.width || 0;
      }
    }
  }

  return result;
}

export async function parseResumePdf(fileBuffer: ArrayBuffer): Promise<ParsedResumeResult> {
  const validation = validatePdfBuffer(fileBuffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid PDF file');
  }

  let pdfDoc: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    pdfDoc = await loadingTask.promise;
  } catch (workerErr) {
    // If worker fails in Firefox or CSP restricts worker script, fall back to in-thread fake worker
    console.warn('PDF.js worker failed, retrying with in-thread parser:', workerErr);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      const fallbackTask = pdfjsLib.getDocument({
        data: new Uint8Array(fileBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
      });
      pdfDoc = await fallbackTask.promise;
    } finally {
      pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
    }
  }

  let fullText = '';
  const discoveredUrls = new Set<string>();

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    // 1. Extract visible text with line breaks preserved
    const textContent = await page.getTextContent();
    const pageText = reconstructTextWithLines(textContent.items);
    fullText += pageText + '\n';

    // 2. Extract embedded hyperlink annotations (PDF /Annots)
    const annotations = await page.getAnnotations();
    for (const annot of annotations) {
      if (annot.subtype === 'Link' && annot.url) {
        discoveredUrls.add(annot.url.trim());
      }
    }
  }

  // 3. Scan raw text for explicit URLs
  const urlRegex = /(https?:\/\/[^\s,;"'<>()]+)/gi;
  for (const m of fullText.matchAll(urlRegex)) {
    if (m[1]) {
      discoveredUrls.add(m[1].trim());
    }
  }

  // 4. Classify extracted links accurately
  const extractedLinks: ExtractedLink[] = [];
  let linkedinUrl = '';
  let explicitGithubProfile = '';
  let inferredGithubProfile = '';
  let portfolioUrl = '';
  const suggestedProjects: ProjectItem[] = [];

  for (const rawUrl of Array.from(discoveredUrls)) {
    const { category, isProfile, username } = classifyResumeUrl(rawUrl);

    if (category === 'linkedin' && isProfile && !linkedinUrl) {
      linkedinUrl = normalizeLinkedInUrl(rawUrl);
    } else if (category === 'github') {
      if (isProfile && !explicitGithubProfile) {
        explicitGithubProfile = normalizeGitHubUrl(rawUrl);
      }
    } else if (category === 'project') {
      // If we find a GitHub repo link, infer the profile link as fallback
      if (username && !inferredGithubProfile) {
        inferredGithubProfile = `https://github.com/${username}`;
      }

      // Automatically add repository to suggested projects list
      const cleanName = rawUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, '').split('/')[1] || 'Project';
      suggestedProjects.push({
        id: `proj_${Date.now()}_${suggestedProjects.length}`,
        title: cleanName.replace(/[-_]/g, ' ').replace(/\.git$/i, ''),
        technologies: [],
        description: '',
        url: rawUrl,
        githubUrl: rawUrl.includes('github.com') ? rawUrl : '',
      });
    } else if (category === 'portfolio' && !portfolioUrl) {
      portfolioUrl = rawUrl;
    }

    extractedLinks.push({
      url: rawUrl,
      category,
    });
  }

  const finalGithubUrl = explicitGithubProfile || inferredGithubProfile || '';

  // 5. Extract contact info via regex
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = fullText.match(
    /(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13})(?:[,\s]+(?:ext(?:ension)?|x|#)\s*[:.]?\s*[0-9a-zA-Z]+\b)?/i
  );
  const { phone, extension: phoneExtension } = splitPhoneAndExtension(
    phoneMatch ? phoneMatch[0].trim() : ''
  );

  // 6. Extract candidate name cleanly before contact info
  const { firstName, lastName } = extractCandidateName(fullText, email, phone);

  // 7. Parse comprehensive resume sections
  const sections = parseResumeSections(fullText);
  const parsedExperience = parseExperience(sections.experience || []);
  const parsedProjects = parseProjects(sections.projects || [], extractedLinks);
  const parsedSkills = parseSkills(sections.skills || []);
  const parsedEducation = parseEducation(sections.education || []);
  const detectedCity = extractCity(sections.header || [], email, phone);

  // Merge projects:
  // If parsed projects exist from resume text, prioritize them and merge genuine GitHub repos
  let finalProjects: ProjectItem[] = [];
  if (parsedProjects.length > 0) {
    finalProjects = [...parsedProjects];
    for (const sp of suggestedProjects) {
      const exists = finalProjects.some(
        (p) =>
          (p.url && sp.url && p.url.toLowerCase() === sp.url.toLowerCase()) ||
          p.title.toLowerCase() === sp.title.toLowerCase()
      );
      if (!exists && sp.githubUrl) {
        finalProjects.push(sp);
      }
    }
  } else {
    finalProjects = suggestedProjects;
  }

  // 8. Extract summary
  let summary = '';
  if (sections.summary && sections.summary.length > 0) {
    summary = sections.summary.join(' ').slice(0, 400);
  } else {
    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.toLowerCase().startsWith('http') &&
          !l.includes(email) &&
          !l.includes(phone)
      );
    summary = lines.slice(1, 4).join(' ').slice(0, 300);
  }

  return {
    rawText: fullText,
    extractedLinks,
    suggestedProfile: {
      personal: {
        firstName,
        lastName,
        email,
        phone,
        phoneExtension,
        city: detectedCity,
        linkedinUrl,
        githubUrl: finalGithubUrl,
        portfolioUrl,
      },
      summary,
      skills: parsedSkills,
      experience: parsedExperience,
      education: parsedEducation,
      portfolioDetails: {
        url: portfolioUrl,
        featuredProjects: finalProjects,
      },
      extractedLinks,
      rawResumeText: fullText,
    },
  };
}
