/**
 * Job Description (JD) Resolver Utility
 * Implements multi-tier discovery for job descriptions when filling job applications.
 */

export interface JobDescriptionResult {
  source: 'inline_dom' | 'derived_ats_url' | 'referrer_url' | 'opener_tab' | 'user_input';
  sourceUrl?: string;
  title?: string;
  company?: string;
  jdText: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Checks whether a candidate text string contains substantive job description content.
 */
export function isValidJobDescription(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 180) return false;

  const keywords = [
    /responsibilit/i,
    /requirement/i,
    /qualificat/i,
    /duties/i,
    /experience/i,
    /skills/i,
    /about (the role|us|you|the job|the team)/i,
    /what you('ll| will) do/i,
    /what we('re| are) looking for/i,
    /who you are/i,
    /tech stack/i,
    /compensation|salary|benefits/i,
    /job summary|overview/i,
  ];

  let matches = 0;
  for (const regex of keywords) {
    if (regex.test(clean)) matches++;
  }
  return matches >= 2;
}

/**
 * Deterministically derives the Job Posting / JD URL from an ATS application form URL.
 * e.g. boards.greenhouse.io/company/jobs/123/apply -> boards.greenhouse.io/company/jobs/123
 */
export function deriveJobPostingUrl(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;

    // 1. Greenhouse job boards
    if (host.includes('greenhouse.io')) {
      if (path.endsWith('/apply')) {
        url.pathname = path.replace(/\/apply\/?$/, '');
        url.hash = '';
        url.search = '';
        return url.toString();
      }
      if (url.hash === '#app' || url.hash.includes('app')) {
        url.hash = '';
        return url.toString();
      }
      // Embedded iframe format: /embed/job_app?for=company&token=12345
      if (path.includes('/embed/job_app') && url.searchParams.has('for') && url.searchParams.has('token')) {
        const company = url.searchParams.get('for');
        const token = url.searchParams.get('token');
        return `https://boards.greenhouse.io/${company}/jobs/${token}`;
      }
    }

    // 2. Lever
    if (host.includes('lever.co')) {
      if (path.endsWith('/apply')) {
        url.pathname = path.replace(/\/apply\/?$/, '');
        url.hash = '';
        return url.toString();
      }
    }

    // 3. Ashby
    if (host.includes('ashbyhq.com')) {
      if (path.includes('/application')) {
        url.pathname = path.replace(/\/application\/?$/, '');
        url.hash = '';
        return url.toString();
      }
    }

    // 4. Workable
    if (host.includes('workable.com')) {
      if (path.endsWith('/apply')) {
        url.pathname = path.replace(/\/apply\/?$/, '');
        url.hash = '';
        return url.toString();
      }
    }

    // 5. Workday
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
      if (path.endsWith('/apply')) {
        url.pathname = path.replace(/\/apply\/?$/, '');
        url.hash = '';
        return url.toString();
      }
    }

    // 6. Generic rule: strip trailing /apply or /application
    if (/\/apply\/?$/i.test(path)) {
      url.pathname = path.replace(/\/apply\/?$/i, '');
      url.hash = '';
      return url.toString();
    }
    if (/\/application\/?$/i.test(path)) {
      url.pathname = path.replace(/\/application\/?$/i, '');
      url.hash = '';
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cleans an HTML document string (from external fetch) into clean, high-density text for LLM consumption.
 * Strips script tags, navigation, headers, footers, SVGs, and normalizes whitespaces.
 */
export function extractCleanJDFromHtml(html: string): { title?: string; company?: string; jdText: string } {
  if (!html) return { jdText: '' };

  // Strip non-content blocks
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');

  // Extract page title or role
  const titleMatch = cleaned.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  if (title) {
    title = title.split(/[-|–•]/)[0].trim();
  }

  // Format line breaks and block tags
  cleaned = cleaned
    .replace(/<(h[1-6]|p|div|li|tr|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fullText = lines.join('\n');
  const excerpt = fullText.slice(0, 4000);

  return {
    title,
    jdText: excerpt,
  };
}

/**
 * Scans the current DOM to detect if an inline Job Description container is already present on page.
 */
export function extractInlineJD(doc: Document = document): JobDescriptionResult | null {
  const candidateSelectors = [
    '[data-automation-id="job-posting-description"]',
    '.job-description',
    '#content',
    '.description',
    'article',
    'main',
    '[class*="job-details"]',
    '[class*="section-job-description"]',
  ];

  for (const sel of candidateSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.textContent || '';
      if (isValidJobDescription(text)) {
        const title = doc.querySelector('h1')?.textContent?.trim() || doc.title.split(/[-|–]/)[0]?.trim();
        return {
          source: 'inline_dom',
          title,
          jdText: text.replace(/\s+/g, ' ').trim().slice(0, 4000),
          confidence: 'high',
        };
      }
    }
  }

  return null;
}
