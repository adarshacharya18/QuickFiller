import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ExtractedLink, CandidateProfile, ProjectItem } from '../types/profile';

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

export async function parseResumePdf(fileBuffer: ArrayBuffer): Promise<ParsedResumeResult> {
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
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(fullText)) !== null) {
    discoveredUrls.add(match[1].trim());
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

  const phoneMatch = fullText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : '';

  // 6. Extract candidate name cleanly before contact info
  const { firstName, lastName } = extractCandidateName(fullText, email, phone);

  // 7. Extract initial summary lines
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
        city: '',
        linkedinUrl,
        githubUrl: finalGithubUrl,
        portfolioUrl,
      },
      summary,
      portfolioDetails: {
        url: portfolioUrl,
        featuredProjects: suggestedProjects,
      },
      extractedLinks,
    },
  };
}
