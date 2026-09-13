import { describe, it, expect } from 'vitest';
import { isValidJobDescription, deriveJobPostingUrl } from '../src/utils/jdResolver';

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

    it('derives parent posting URL from Lever apply URL', () => {
      const applyUrl = 'https://jobs.lever.co/acme/abcd-1234/apply';
      expect(deriveJobPostingUrl(applyUrl)).toBe('https://jobs.lever.co/acme/abcd-1234');
    });

    it('derives parent posting URL from Ashby apply URL', () => {
      const applyUrl = 'https://jobs.ashbyhq.com/acme/abcd-1234/application';
      expect(deriveJobPostingUrl(applyUrl)).toBe('https://jobs.ashbyhq.com/acme/abcd-1234');
    });

    it('returns null for non-ATS or already clean URLs', () => {
      expect(deriveJobPostingUrl('https://example.com/careers')).toBeNull();
      expect(deriveJobPostingUrl('https://boards.greenhouse.io/acme/jobs/12345')).toBeNull();
    });
  });
});
