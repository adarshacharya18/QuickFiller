import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ExtractedLink, CandidateProfile } from '../types/profile';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedResumeResult {
  rawText: string;
  extractedLinks: ExtractedLink[];
  suggestedProfile: Partial<CandidateProfile>;
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

  // 3. Also scan raw text for explicit URLs via regex
  const urlRegex = /(https?:\/\/[^\s,;"'<>()]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(fullText)) !== null) {
    discoveredUrls.add(match[1].trim());
  }

  // 4. Classify extracted links
  const extractedLinks: ExtractedLink[] = [];
  let linkedinUrl = '';
  let githubUrl = '';
  let portfolioUrl = '';

  for (const rawUrl of Array.from(discoveredUrls)) {
    const lower = rawUrl.toLowerCase();
    let category: ExtractedLink['category'] = 'other';

    if (lower.includes('linkedin.com/in/') || lower.includes('linkedin.com')) {
      category = 'linkedin';
      if (!linkedinUrl) linkedinUrl = rawUrl;
    } else if (lower.includes('github.com')) {
      category = 'github';
      if (!githubUrl) githubUrl = rawUrl;
    } else if (
      lower.includes('portfolio') ||
      lower.includes('.dev') ||
      lower.includes('.me') ||
      lower.includes('vercel.app') ||
      lower.includes('netlify.app') ||
      lower.includes('.io') ||
      lower.includes('github.io')
    ) {
      category = 'portfolio';
      if (!portfolioUrl) portfolioUrl = rawUrl;
    } else {
      category = 'project';
    }

    extractedLinks.push({
      url: rawUrl,
      category,
    });
  }

  // 5. Basic heuristic extraction for personal information
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = fullText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : '';

  // Attempt to identify candidate name from first non-empty lines
  const lines = fullText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.toLowerCase().startsWith('http'));
  
  let firstName = '';
  let lastName = '';
  if (lines.length > 0) {
    const nameCandidate = lines[0].split(/\s+/).slice(0, 4).join(' ');
    const parts = nameCandidate.split(' ');
    if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else if (parts.length === 1) {
      firstName = parts[0];
    }
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
        city: '',
        linkedinUrl,
        githubUrl,
        portfolioUrl,
      },
      summary: lines.slice(1, 4).join(' ').slice(0, 300),
      portfolioDetails: {
        url: portfolioUrl,
        featuredProjects: [],
      },
      extractedLinks,
    },
  };
}
