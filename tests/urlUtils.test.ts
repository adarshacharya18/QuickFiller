import { describe, it, expect } from 'vitest';
import {
  normalizeLinkedInUrl,
  normalizeGitHubUrl,
  normalizePortfolioUrl,
} from '../src/utils/urlUtils';

describe('URL Normalization Utilities (urlUtils)', () => {
  describe('normalizeLinkedInUrl', () => {
    it('normalizes regional Indian LinkedIn URLs (in.linkedin.com) to canonical format', () => {
      expect(normalizeLinkedInUrl('https://in.linkedin.com/in/adarsh-acharya')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
      expect(normalizeLinkedInUrl('https://in.linkedin.com/in/adarsh-acharya/')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
      expect(normalizeLinkedInUrl('in.linkedin.com/in/adarsh-acharya/')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
    });

    it('normalizes other regional subdomains (uk, ca, au, de, fr, m)', () => {
      expect(normalizeLinkedInUrl('https://uk.linkedin.com/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
      expect(normalizeLinkedInUrl('https://ca.linkedin.com/in/johndoe/')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
      expect(normalizeLinkedInUrl('https://m.linkedin.com/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('adds www. when missing and converts http to https', () => {
      expect(normalizeLinkedInUrl('https://linkedin.com/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
      expect(normalizeLinkedInUrl('http://linkedin.com/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
      expect(normalizeLinkedInUrl('http://www.linkedin.com/in/johndoe')).toBe(
        'https://www.linkedin.com/in/johndoe'
      );
    });

    it('strips tracking query parameters, hash fragments, and trailing slashes', () => {
      expect(
        normalizeLinkedInUrl(
          'https://in.linkedin.com/in/adarsh-acharya/?utm_source=share&utm_medium=member_desktop'
        )
      ).toBe('https://www.linkedin.com/in/adarsh-acharya');

      expect(
        normalizeLinkedInUrl(
          'https://www.linkedin.com/in/adarsh-acharya?trk=public_profile#experience'
        )
      ).toBe('https://www.linkedin.com/in/adarsh-acharya');

      expect(
        normalizeLinkedInUrl(
          'https://www.linkedin.com/in/adarsh-acharya/?originalSubdomain=in'
        )
      ).toBe('https://www.linkedin.com/in/adarsh-acharya');
    });

    it('handles bare username or handle inputs', () => {
      expect(normalizeLinkedInUrl('adarsh-acharya')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
      expect(normalizeLinkedInUrl('@adarsh-acharya')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
      expect(normalizeLinkedInUrl('/in/adarsh-acharya')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
      expect(normalizeLinkedInUrl('in/adarsh-acharya/')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
    });

    it('preserves already canonical LinkedIn URLs without modification', () => {
      expect(normalizeLinkedInUrl('https://www.linkedin.com/in/adarsh-acharya')).toBe(
        'https://www.linkedin.com/in/adarsh-acharya'
      );
    });

    it('handles empty or whitespace strings gracefully', () => {
      expect(normalizeLinkedInUrl('')).toBe('');
      expect(normalizeLinkedInUrl('   ')).toBe('');
      expect(normalizeLinkedInUrl(null as any)).toBe('');
    });
  });

  describe('normalizeGitHubUrl', () => {
    it('normalizes GitHub profile handles and URLs', () => {
      expect(normalizeGitHubUrl('adarsh-acharya')).toBe('https://github.com/adarsh-acharya');
      expect(normalizeGitHubUrl('@adarsh-acharya')).toBe('https://github.com/adarsh-acharya');
      expect(normalizeGitHubUrl('github.com/adarsh-acharya/')).toBe(
        'https://github.com/adarsh-acharya'
      );
      expect(normalizeGitHubUrl('http://github.com/adarsh-acharya')).toBe(
        'https://github.com/adarsh-acharya'
      );
      expect(normalizeGitHubUrl('https://github.com/adarsh-acharya')).toBe(
        'https://github.com/adarsh-acharya'
      );
    });
  });

  describe('normalizePortfolioUrl', () => {
    it('ensures https protocol and strips trailing slashes', () => {
      expect(normalizePortfolioUrl('myportfolio.dev/')).toBe('https://myportfolio.dev');
      expect(normalizePortfolioUrl('http://myportfolio.dev')).toBe('http://myportfolio.dev');
      expect(normalizePortfolioUrl('https://myportfolio.dev/')).toBe('https://myportfolio.dev');
    });
  });
});
