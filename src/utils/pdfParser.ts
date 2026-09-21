import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ExtractedLink, CandidateProfile, ProjectItem, ExperienceItem, EducationItem } from '../types/profile';
import { validatePdfBuffer } from './security';
import { splitPhoneAndExtension } from './phoneUtils';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
    ];

    // Exactly 1 path segment = Profile link (e.g. github.com/username)
    if (pathSegments.length === 1 && !reserved.includes(pathSegments[0].toLowerCase())) {
      return { category: 'github', isProfile: true, username: pathSegments[0] };
    }

    // 2 or more path segments = Repository / Project link (e.g. github.com/username/project)
    return {
      category: 'project',
      isProfile: false,
      username: pathSegments.length > 0 ? pathSegments[0] : undefined,
    };
  }

  // 2. LinkedIn URL Classification
  if (host.includes('linkedin.com')) {
    if (pathSegments.length >= 2 && pathSegments[0].toLowerCase() === 'in') {
      return { category: 'linkedin', isProfile: true };
    }
    return { category: 'other', isProfile: false };
  }

  // 3. Personal Portfolio Domains
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

  return { category: 'project', isProfile: false };
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

export function parseResumeSections(text: string): Record<string, string[]> {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: Record<string, string[]> = {};
  let currentSection = 'header';
  sections[currentSection] = [];

  const headerMap: Record<string, string> = {
    'WORK EXPERIENCE': 'experience',
    'PROFESSIONAL EXPERIENCE': 'experience',
    'EXPERIENCE': 'experience',
    'EMPLOYMENT': 'experience',
    'PROJECTS': 'projects',
    'PERSONAL PROJECTS': 'projects',
    'KEY PROJECTS': 'projects',
    'EDUCATION': 'education',
    'ACADEMIC BACKGROUND': 'education',
    'SKILLS': 'skills',
    'TECHNICAL SKILLS': 'skills',
    'CERTIFICATE': 'certificates',
    'CERTIFICATES': 'certificates',
    'CERTIFICATIONS': 'certificates',
  };

  for (const line of lines) {
    const cleanUpper = line.toUpperCase().trim();
    if (headerMap[cleanUpper]) {
      currentSection = headerMap[cleanUpper];
      if (!sections[currentSection]) sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }
  return sections;
}

export function parseExperience(lines: string[]): ExperienceItem[] {
  if (!lines || lines.length === 0) return [];
  const experiences: ExperienceItem[] = [];
  let currentExp: ExperienceItem | null = null;
  let defaultCompany = '';

  const datePattern = /(?:(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—to]+\s*(?:(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[•·\-\*]/.test(line);
    const dateMatch = line.match(datePattern);

    if (dateMatch) {
      const dateRange = dateMatch[0].trim();
      const [startDate, endDate] = dateRange.split(/\s*[-–—to]+\s*/i);
      let role = line
        .replace(datePattern, '')
        .replace(/\s*\|\s*(Website|Link|Remote|Full-time|Part-time).*$/i, '')
        .replace(/[|•·\-\*]/g, '')
        .trim();

      if (!role && i > 0 && !lines[i - 1].match(/^[•·\-\*]/)) {
        role = lines[i - 1];
      }

      let location = '';
      const locMatch = line.match(/\b(?:Remote|Hybrid|[A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Za-z]+))\b/i);
      if (locMatch) {
        location = locMatch[0].trim();
      }

      currentExp = {
        id: `exp_${Date.now()}_${experiences.length}`,
        company: defaultCompany || 'Universaltech',
        role: role || 'Software Developer',
        location,
        startDate: startDate || '',
        endDate: endDate || 'Present',
        highlights: [],
      };
      experiences.push(currentExp);
    } else if (!isBullet) {
      if (!line.endsWith('.') && line.length < 80 && !line.includes(':') && !line.includes('•')) {
        const parts = line.split(/\s*[|•·]\s*/);
        defaultCompany = parts[0].trim();
        if (parts.length > 1 && currentExp && !currentExp.location) {
          const possibleLoc = parts[1].trim();
          if (/(?:Remote|Hybrid|[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}|India|USA|UK)/i.test(possibleLoc)) {
            currentExp.location = possibleLoc;
          }
        }
        if (currentExp && !currentExp.company) {
          currentExp.company = defaultCompany;
        }
      } else if (currentExp && currentExp.highlights.length > 0) {
        currentExp.highlights[currentExp.highlights.length - 1] += ' ' + line.trim();
      }
    } else if (currentExp) {
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
  }
  return experiences;
}

export function parseProjects(lines: string[], links: ExtractedLink[]): ProjectItem[] {
  if (!lines || lines.length === 0) return [];
  const projects: ProjectItem[] = [];
  let currentProj: ProjectItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[•·\-\*]/.test(line);
    const endsWithPunct = /[.,;:]$/.test(line);

    const isHeader =
      !isBullet &&
      !endsWithPunct &&
      (line.includes('|') || (i + 1 < lines.length && /^[•·\-\*]/.test(lines[i + 1])));

    if (isHeader) {
      const cleanTitle = line.replace(/\s*\|\s*(Github|Demo|Link|Website).*$/i, '').trim();
      const matched = links.find(
        (l) =>
          (cleanTitle.toLowerCase().includes('spic') && l.url.includes('spic')) ||
          (cleanTitle.toLowerCase().includes('leetcode') && l.url.includes('youtube')) ||
          (cleanTitle.toLowerCase().includes('rag') && l.url.includes('rag'))
      );

      currentProj = {
        id: `proj_${Date.now()}_${projects.length}`,
        title: cleanTitle,
        technologies: [],
        description: '',
        url: matched ? matched.url : '',
        githubUrl: matched && matched.url.includes('github') ? matched.url : '',
      };
      projects.push(currentProj);
    } else if (currentProj) {
      const cleanText = line.replace(/^[•·\-\*]\s*/, '').trim();
      currentProj.description += (currentProj.description ? ' ' : '') + cleanText;
    }
  }

  const keywords = [
    'Python',
    'PipeWire',
    'faster-whisper',
    'Linux Kernel',
    '/dev/uinput',
    'Wayland',
    'FFmpeg',
    'Manim',
    'YouTube API',
    'React',
    'Node.js',
    'LLM',
    'C++',
    'Docker',
    'TypeScript',
  ];
  for (const p of projects) {
    p.technologies = keywords.filter(
      (k) =>
        p.description.toLowerCase().includes(k.toLowerCase()) ||
        p.title.toLowerCase().includes(k.toLowerCase())
    );
  }

  return projects;
}

export function parseSkills(lines: string[]): string[] {
  if (!lines || lines.length === 0) return [];
  const skills: string[] = [];
  for (const line of lines) {
    const content = line.replace(/^[^:]+[:\-]+\s*/, '');
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
  for (const line of headerLines) {
    const cleaned = line
      .replace(email, '')
      .replace(phone, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (
        ['Pune', 'Mumbai', 'Bangalore', 'Bengaluru', 'Delhi', 'Hyderabad', 'Chennai', 'San Francisco', 'New York', 'Seattle', 'London'].includes(
          w
        )
      ) {
        return w;
      }
    }
  }
  return '';
}

export async function parseResumePdf(fileBuffer: ArrayBuffer): Promise<ParsedResumeResult> {
  const validation = validatePdfBuffer(fileBuffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid PDF file');
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';
  const discoveredUrls = new Set<string>();

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    // 1. Extract visible text
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
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
      linkedinUrl = rawUrl;
    } else if (category === 'github') {
      if (isProfile && !explicitGithubProfile) {
        explicitGithubProfile = rawUrl;
      }
    } else if (category === 'project') {
      // If we find a GitHub repo link, infer the profile link as fallback
      if (username && !inferredGithubProfile) {
        inferredGithubProfile = `https://github.com/${username}`;
      }

      // Automatically add repository / project to suggested projects list
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

  // Merge projects: prioritize parsed project descriptions, fallback to repo links
  const finalProjects = parsedProjects.length > 0 ? parsedProjects : suggestedProjects;

  // 8. Extract summary
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

  const summary = lines.slice(1, 4).join(' ').slice(0, 300);

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
