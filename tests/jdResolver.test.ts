import { describe, it, expect } from 'vitest';
import {
  isValidJobDescription,
  deriveJobPostingUrl,
  cleanHtmlSnippet,
  parseJobPostingFromLdJson,
  extractCleanJDFromHtml,
  extractInlineJD,
} from '../src/utils/jdResolver';

describe('Job Description (JD) Resolver Engine', () => {
  describe('Substantive Content Validation (isValidJobDescription)', () => {
    it('validates substantive job descriptions containing requirements and role details', () => {
      const substantiveJd = `
        About the Role:
        LeadSquared is looking for an experienced Senior Frontend Engineer to build robust enterprise web applications.
        Responsibilities:
        - Develop performant web components and maintain scalable frontend architectures.
        - Collaborate with backend engineers to integrate REST and GraphQL APIs.
        Requirements:
        - 5+ years of software engineering experience with TypeScript and Angular or React.
        - Strong background in web accessibility and browser performance tuning.
      `;

      expect(isValidJobDescription(substantiveJd)).toBe(true);
    });

    it('rejects short non-substantive text or navigation boilerplate', () => {
      expect(isValidJobDescription('Home > Careers > Apply')).toBe(false);
      expect(isValidJobDescription('Submit your resume and contact info.')).toBe(false);
      expect(isValidJobDescription('')).toBe(false);
    });

    it('requires both sufficient length and multiple relevant keywords', () => {
      const longWithoutKeywords = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
      expect(isValidJobDescription(longWithoutKeywords)).toBe(false);
    });
  });

  describe('ATS Job Posting URL Derivation (deriveJobPostingUrl)', () => {
    it('derives parent posting URL from Greenhouse apply URL', () => {
      const applyUrl = 'https://boards.greenhouse.io/acme/jobs/12345/apply';
      expect(deriveJobPostingUrl(applyUrl)).toBe('https://boards.greenhouse.io/acme/jobs/12345');
    });

    it('derives parent posting URL from Greenhouse confirmation URL (job-boards.greenhouse.io)', () => {
      const confirmationUrl =
        'https://job-boards.greenhouse.io/headoutcareers/jobs/4707747006/confirmation?gh_src=sxne3lxs6us';
      expect(deriveJobPostingUrl(confirmationUrl)).toBe(
        'https://job-boards.greenhouse.io/headoutcareers/jobs/4707747006'
      );
    });

    it('derives parent posting URL from Lever apply URL', () => {
      const applyUrl = 'https://jobs.lever.co/acme/abcd-1234/apply';
      expect(deriveJobPostingUrl(applyUrl)).toBe('https://jobs.lever.co/acme/abcd-1234');
    });

    it('derives parent posting URL from Ashby apply URL', () => {
      const applyUrl = 'https://jobs.ashbyhq.com/acme/abcd-1234/application';
      expect(deriveJobPostingUrl(applyUrl)).toBe('https://jobs.ashbyhq.com/acme/abcd-1234');
    });

    it('derives parent posting URL from Workday /apply/applyManually wizard URL', () => {
      const applyUrl = 'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1/apply/applyManually';
      expect(deriveJobPostingUrl(applyUrl)).toBe(
        'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1'
      );
    });

    it('derives parent posting URL from Workday /apply/autofillWithResume wizard URL', () => {
      const applyUrl = 'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1/apply/autofillWithResume';
      expect(deriveJobPostingUrl(applyUrl)).toBe(
        'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1'
      );
    });

    it('derives parent posting URL from Workday /apply?step=myExperience query URL', () => {
      const applyUrl = 'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1/apply?step=myExperience';
      expect(deriveJobPostingUrl(applyUrl)).toBe(
        'https://firstadvantage.wd5.myworkdayjobs.com/FirstAdvantage/job/IN_Bangalore_Virtual/Sr-Software-Engineer_R9604-1'
      );
    });

    it('returns null for non-ATS or already clean URLs', () => {
      expect(deriveJobPostingUrl('https://example.com/careers')).toBeNull();
      expect(deriveJobPostingUrl('https://boards.greenhouse.io/acme/jobs/12345')).toBeNull();
    });
  });

  describe('HTML Snippet Cleaning (cleanHtmlSnippet)', () => {
    it('converts block HTML tags to newlines and decodes HTML entities', () => {
      const input = '<p><b>Responsibilities:</b></p><ul><li>Scripting &amp; coding to spec</li><li>Migration to AWS</li></ul>';
      const cleaned = cleanHtmlSnippet(input);
      expect(cleaned).toContain('Responsibilities:');
      expect(cleaned).toContain('Scripting & coding to spec');
      expect(cleaned).toContain('Migration to AWS');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('&amp;');
    });
  });

  describe('Schema.org JSON-LD Extraction (parseJobPostingFromLdJson)', () => {
    it('extracts JobPosting title, company, and description accurately', () => {
      const jsonLd = JSON.stringify({
        '@context': 'http://schema.org',
        '@type': 'JobPosting',
        title: 'Software Engineer',
        hiringOrganization: {
          '@type': 'Organization',
          name: 'First Advantage Global Operating Center (GOC)',
        },
        description:
          '<p>What You\'ll Do: A successful sr Software Engineer will be part of First Advantage team. Responsibilities: Automation &amp; Scripting, migration to AWS, analyzing ongoing issues. What You Need: Bachelor\'s degree in CS, 3-6 years of experience with Python, Node.js, and AWS.</p>',
      });

      const parsed = parseJobPostingFromLdJson(jsonLd);
      expect(parsed).not.toBeNull();
      expect(parsed?.title).toBe('Software Engineer');
      expect(parsed?.company).toBe('First Advantage Global Operating Center (GOC)');
      expect(parsed?.jdText).toContain('Responsibilities: Automation & Scripting');
      expect(isValidJobDescription(parsed!.jdText!)).toBe(true);
    });

    it('extracts JobPosting wrapped inside an array or @graph', () => {
      const graphJson = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'Careers Page' },
          {
            '@type': 'JobPosting',
            title: 'Lead Architect',
            hiringOrganization: { name: 'Acme Corp' },
            description:
              'About the role: Lead architectural initiatives. Responsibilities: System design, scaling services. Requirements: 8+ years experience with distributed systems and Kubernetes.',
          },
        ],
      });

      const parsed = parseJobPostingFromLdJson(graphJson);
      expect(parsed).not.toBeNull();
      expect(parsed?.title).toBe('Lead Architect');
      expect(parsed?.company).toBe('Acme Corp');
      expect(parsed?.jdText).toContain('Responsibilities: System design');
    });
  });

  describe('External HTML Extraction with Schema.org & Workday SPA (extractCleanJDFromHtml)', () => {
    it('extracts JD from Workday HTML containing <script type="application/ld+json">', () => {
      const workdayHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sr Software Engineer - First Advantage</title>
          <script type="application/ld+json">
          {
            "@context" : "http://schema.org",
            "@type" : "JobPosting",
            "title" : "Software Engineer",
            "hiringOrganization" : {
              "name" : "First Advantage Global Operating Center (GOC)"
            },
            "description" : "What You'll Do: A successful sr Software Engineer and will be part of First Advantage Fulfillment team. Responsibilities: Automation &amp; Scripting, Coding to technical specification, Migration of application and data to AWS. Requirements: Bachelor’s degree in computer science, 3-6 years of experience in Python and Node.js along with AWS Cloud."
          }
          </script>
        </head>
        <body>
          <div id="root"></div>
        </body>
        </html>
      `;

      const result = extractCleanJDFromHtml(workdayHtml);
      expect(result.title).toBe('Software Engineer');
      expect(result.company).toBe('First Advantage Global Operating Center (GOC)');
      expect(result.jdText).toContain('Responsibilities: Automation & Scripting');
      expect(isValidJobDescription(result.jdText)).toBe(true);
    });

    it('extracts JD from Workday CXS API JSON response', () => {
      const cxsJson = JSON.stringify({
        jobPostingInfo: {
          title: 'Staff Platform Engineer',
          jobDescription:
            '<p>Overview: Looking for a Staff Platform Engineer. Responsibilities: Manage Kubernetes clusters, lead platform stability. Requirements: 7+ years DevOps experience with Terraform, Go, and AWS.</p>',
        },
        hiringOrganization: {
          name: 'NVIDIA',
        },
      });

      const result = extractCleanJDFromHtml(cxsJson);
      expect(result.title).toBe('Staff Platform Engineer');
      expect(result.company).toBe('NVIDIA');
      expect(result.jdText).toContain('Responsibilities: Manage Kubernetes');
      expect(isValidJobDescription(result.jdText)).toBe(true);
    });

    it('falls back to visible HTML text when no JSON-LD is available', () => {
      const standardHtml = `
        <html>
        <head><title>Full Stack Developer | Stripe</title></head>
        <body>
          <main>
            <h1>Full Stack Developer</h1>
            <p>About the Role: We are hiring a full stack engineer. Responsibilities include building scalable financial APIs. Requirements: 4+ years experience with Ruby, Go, and React.</p>
          </main>
        </body>
        </html>
      `;

      const result = extractCleanJDFromHtml(standardHtml);
      expect(result.title).toBe('Full Stack Developer');
      expect(result.jdText).toContain('Responsibilities include building');
      expect(isValidJobDescription(result.jdText)).toBe(true);
    });
  });

  describe('Inline DOM JD Extraction (extractInlineJD)', () => {
    it('extracts from DOM containing <script type="application/ld+json">', () => {
      document.body.innerHTML = `
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "title": "Backend Engineer",
          "hiringOrganization": { "name": "First Advantage" },
          "description": "Responsibilities: Build distributed microservices. Requirements: 5+ years of experience with Python, FastAPI, and Postgres."
        }
        </script>
      `;

      const result = extractInlineJD(document);
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Backend Engineer');
      expect(result?.company).toBe('First Advantage');
      expect(result?.jdText).toContain('Responsibilities: Build distributed microservices');
      expect(result?.source).toBe('inline_dom');
    });

    it('extracts from Workday DOM rendered with data-automation-id="jobPostingDescription"', () => {
      document.body.innerHTML = `
        <h1 data-automation-id="jobPostingHeader">Senior DevOps Engineer</h1>
        <div data-automation-id="companyName">First Advantage</div>
        <div data-automation-id="jobPostingDescription">
          <div data-automation-id="richText">
            <h3>About the Role</h3>
            <p>We are seeking a Senior DevOps Engineer. Responsibilities include cloud infrastructure management and CI/CD pipelines. Requirements: 5+ years experience with Kubernetes, Docker, and AWS.</p>
          </div>
        </div>
      `;

      const result = extractInlineJD(document);
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Senior DevOps Engineer');
      expect(result?.company).toBe('First Advantage');
      expect(result?.jdText).toContain('Responsibilities include cloud infrastructure');
    });
  });
});
