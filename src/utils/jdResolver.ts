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

    // 5. Workday: Handle /apply, /apply/applyManually, /apply/autofillWithResume, etc.
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
      if (/\/apply(?:\/.*)?$/i.test(path)) {
        url.pathname = path.replace(/\/apply(?:\/.*)?$/i, '');
        url.hash = '';
        url.search = '';
        return url.toString();
      }
    }

    // 6. Generic rule: strip trailing /apply or /application with optional subpaths
    if (/\/apply(?:\/.*)?$/i.test(path)) {
      url.pathname = path.replace(/\/apply(?:\/.*)?$/i, '');
      url.hash = '';
      url.search = '';
      return url.toString();
    }
    if (/\/application(?:\/.*)?$/i.test(path)) {
      url.pathname = path.replace(/\/application(?:\/.*)?$/i, '');
      url.hash = '';
      url.search = '';
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes an HTML snippet into clean, readable text by converting block tags into newlines.
 */
export function cleanHtmlSnippet(str: string): string {
  if (!str) return '';
  return str
    .replace(/<(h[1-6]|p|div|li|tr|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

/**
 * Parses Schema.org JobPosting from a JSON-LD string.
 */
export function parseJobPostingFromLdJson(
  rawJson: string
): { title?: string; company?: string; jdText?: string } | null {
  try {
    const data = JSON.parse(rawJson);
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      // Handle @graph schema arrays (common in WordPress / Yoast SEO)
      if (Array.isArray(item['@graph'])) {
        for (const subItem of item['@graph']) {
          if (subItem && (subItem['@type'] === 'JobPosting' || String(subItem['@type']).includes('JobPosting'))) {
            const desc = cleanHtmlSnippet(subItem.description || '');
            if (
              desc.length >= 80 &&
              (isValidJobDescription(desc) ||
                /responsibilit|requirement|qualificat|experience|skills|duties|about/i.test(desc))
            ) {
              return {
                title: subItem.title ? String(subItem.title).split(/[-|–•]/)[0].trim() : undefined,
                company: subItem.hiringOrganization?.name ? String(subItem.hiringOrganization.name).trim() : undefined,
                jdText: desc.slice(0, 4000),
              };
            }
          }
        }
      }

      if (item['@type'] === 'JobPosting' || String(item['@type']).includes('JobPosting')) {
        const desc = cleanHtmlSnippet(item.description || '');
        if (
          desc.length >= 80 &&
          (isValidJobDescription(desc) ||
            /responsibilit|requirement|qualificat|experience|skills|duties|about/i.test(desc))
        ) {
          return {
            title: item.title ? String(item.title).split(/[-|–•]/)[0].trim() : undefined,
            company: item.hiringOrganization?.name ? String(item.hiringOrganization.name).trim() : undefined,
            jdText: desc.slice(0, 4000),
          };
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Cleans an HTML document string (from external fetch) into clean, high-density text for LLM consumption.
 * Checks for Schema.org JSON-LD first (critical for SPAs like Workday), then falls back to visible text parsing.
 */
export function extractCleanJDFromHtml(html: string): { title?: string; company?: string; jdText: string } {
  if (!html) return { jdText: '' };

  // 1. Check if raw response is JSON (e.g. Workday CXS API or ATS REST endpoint)
  if (html.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(html);
      // Workday CXS API format: { jobPostingInfo: { title, jobDescription }, hiringOrganization: { name } }
      if (parsed?.jobPostingInfo?.jobDescription) {
        const jdClean = cleanHtmlSnippet(parsed.jobPostingInfo.jobDescription);
        if (isValidJobDescription(jdClean)) {
          return {
            title: parsed.jobPostingInfo.title || undefined,
            company: parsed.hiringOrganization?.name || undefined,
            jdText: jdClean.slice(0, 4000),
          };
        }
      }
    } catch {}
  }

  // 2. Try extracting standard Schema.org JobPosting from <script type="application/ld+json">
  const ldJsonRegex = /<script\b[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldJsonRegex.exec(html)) !== null) {
    const rawContent = match[1]?.trim();
    if (rawContent) {
      const parsedLd = parseJobPostingFromLdJson(rawContent);
      if (parsedLd && parsedLd.jdText) {
        return {
          title: parsedLd.title,
          company: parsedLd.company,
          jdText: parsedLd.jdText,
        };
      }
    }
  }

  // 3. Fallback: Parse visible HTML text (strip non-content blocks)
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

  const jdText = cleanHtmlSnippet(cleaned).slice(0, 4000);

  return {
    title,
    jdText,
  };
}

/**
 * Scans the current DOM to detect if an inline Job Description container is already present on page.
 */
export function extractInlineJD(doc: Document = document): JobDescriptionResult | null {
  // 1. Check for standard Schema.org JobPosting in <script type="application/ld+json">
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      const text = script.textContent || '';
      if (!text.trim()) continue;
      const parsedLd = parseJobPostingFromLdJson(text);
      if (parsedLd && parsedLd.jdText) {
        const title =
          parsedLd.title ||
          doc.querySelector('[data-automation-id="jobPostingHeader"], h1, .job-title, [class*="job-title"]')?.textContent?.trim() ||
          doc.title.split(/[-|–]/)[0]?.trim();
        return {
          source: 'inline_dom',
          title,
          company: parsedLd.company,
          jdText: parsedLd.jdText,
          confidence: 'high',
        };
      }
    }
  } catch {}

  // 2. Check Candidate DOM Selectors (including Workday, Greenhouse, Lever, Ashby, Google Forms, MS Forms)
  const candidateSelectors = [
    '[data-automation-id="jobPostingDescription"]',
    '[data-automation-id="job-posting-description"]',
    '[data-automation-id="richText"]',
    '[data-automation-id="jobPostingPage"]',
    '.job-description',
    '#content',
    '.description',
    'article',
    'main',
    '[class*="job-details"]',
    '[class*="section-job-description"]',
    '.cBGGfd',
    '.freebirdFormviewerViewHeaderDescription',
    '[data-automation-id="formSubtitle"]',
    '.office-form-subtitle',
  ];

  for (const sel of candidateSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const rawText = el.textContent || '';
      const clean = cleanHtmlSnippet(rawText);
      if (isValidJobDescription(clean)) {
        const title =
          doc.querySelector('[data-automation-id="jobPostingHeader"], h1, .job-title, [class*="job-title"]')?.textContent?.trim() ||
          doc.title.split(/[-|–]/)[0]?.trim();
        const company =
          doc.querySelector('[data-automation-id="companyName"], [data-automation-id="legalEntity"], [class*="company-name"]')?.textContent?.trim() ||
          undefined;

        return {
          source: 'inline_dom',
          title,
          company,
          jdText: clean.slice(0, 4000),
          confidence: 'high',
        };
      }
    }
  }

  return null;
}
