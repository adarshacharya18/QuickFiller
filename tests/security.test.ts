import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSafeWebUrl,
  sanitizeWebUrl,
  isSafeExternalUrl,
  redactSecrets,
  validatePdfBuffer,
} from '../src/utils/security';
import { setupOllamaDNRRules } from '../src/utils/rules';
import { mockDynamicRules, resetMockDynamicRules } from './setup';

describe('Security & XSS Defense Utilities', () => {
  describe('isSafeWebUrl & sanitizeWebUrl (DOM XSS / Injection Defense)', () => {
    it('accepts valid https and http URLs', () => {
      expect(isSafeWebUrl('https://example.com')).toBe(true);
      expect(isSafeWebUrl('http://example.com/jobs/123')).toBe(true);
      expect(isSafeWebUrl('https://boards.greenhouse.io/stripe/jobs/456?gh_jid=456')).toBe(true);
      expect(sanitizeWebUrl('https://example.com')).toBe('https://example.com/');
    });

    it('accepts valid mailto links', () => {
      expect(isSafeWebUrl('mailto:candidate@example.com')).toBe(true);
      expect(sanitizeWebUrl('mailto:candidate@example.com')).toBe('mailto:candidate@example.com');
    });

    it('accepts local file: URLs for local testing forms', () => {
      expect(isSafeWebUrl('file:///home/user/form.html')).toBe(true);
      expect(sanitizeWebUrl('file:///home/user/form.html')).toBe('file:///home/user/form.html');
    });

    it('automatically prefixes schemeless web domains with https', () => {
      expect(isSafeWebUrl('linkedin.com/in/johndoe')).toBe(true);
      expect(sanitizeWebUrl('linkedin.com/in/johndoe')).toBe('https://linkedin.com/in/johndoe');
      expect(isSafeWebUrl('github.com/developer')).toBe(true);
      expect(sanitizeWebUrl('github.com/developer')).toBe('https://github.com/developer');
    });

    it('strictly rejects javascript: pseudo-protocol attacks', () => {
      expect(isSafeWebUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeWebUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isSafeWebUrl('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isSafeWebUrl('javascript: void(0)')).toBe(false);
      expect(isSafeWebUrl('javascript:/*--></title></style></textarea></script>alert(1)')).toBe(false);

      expect(sanitizeWebUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeWebUrl('javascript:alert(1)', '')).toBe('');
    });

    it('strictly rejects data: URI attacks', () => {
      expect(isSafeWebUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeWebUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(sanitizeWebUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    });

    it('strictly rejects vbscript: and blob: schemes', () => {
      expect(isSafeWebUrl('vbscript:msgbox("xss")')).toBe(false);
      expect(isSafeWebUrl('blob:http://evil.com/uuid')).toBe(false);
      expect(sanitizeWebUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitizeWebUrl('blob:http://evil.com/uuid')).toBe('#');
    });

    it('rejects control characters and null byte obfuscation attempts', () => {
      expect(isSafeWebUrl('java\u0000script:alert(1)')).toBe(false);
      expect(isSafeWebUrl('https://example.com\u0000/path')).toBe(false);
      expect(isSafeWebUrl('https://example.com\u001f')).toBe(false);
      expect(sanitizeWebUrl('java\u0000script:alert(1)')).toBe('#');
    });

    it('handles empty, null, undefined, and non-string values safely', () => {
      expect(isSafeWebUrl('')).toBe(false);
      expect(isSafeWebUrl('   ')).toBe(false);
      expect(isSafeWebUrl(null as any)).toBe(false);
      expect(isSafeWebUrl(undefined as any)).toBe(false);
      expect(sanitizeWebUrl('')).toBe('#');
      expect(sanitizeWebUrl(null as any)).toBe('#');
      expect(sanitizeWebUrl(undefined as any, 'about:blank')).toBe('about:blank');
    });
  });

  describe('isSafeExternalUrl (SSRF Mitigation)', () => {
    it('allows legitimate public HTTP/HTTPS URLs', () => {
      const res = isSafeExternalUrl('https://boards.greenhouse.io/stripe/jobs/123');
      expect(res.safe).toBe(true);
      expect(res.url?.hostname).toBe('boards.greenhouse.io');
    });

    it('blocks loopback and localhost hostnames', () => {
      expect(isSafeExternalUrl('http://localhost:8080').safe).toBe(false);
      expect(isSafeExternalUrl('http://app.localhost').safe).toBe(false);
      expect(isSafeExternalUrl('http://service.local').safe).toBe(false);
      expect(isSafeExternalUrl('http://metadata.internal').safe).toBe(false);
      expect(isSafeExternalUrl('http://[::1]').safe).toBe(false);
    });

    it('blocks private IPv4 ranges (10.x, 192.168.x, 172.16.x, 127.x)', () => {
      expect(isSafeExternalUrl('http://127.0.0.1:8000').safe).toBe(false);
      expect(isSafeExternalUrl('http://10.0.0.1/admin').safe).toBe(false);
      expect(isSafeExternalUrl('http://192.168.1.1').safe).toBe(false);
      expect(isSafeExternalUrl('http://172.16.0.1').safe).toBe(false);
      expect(isSafeExternalUrl('http://0.0.0.0').safe).toBe(false);
    });

    it('blocks AWS/GCP cloud metadata IP (169.254.169.254)', () => {
      expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
    });

    it('rejects non-HTTP protocols (file:, javascript:, data:)', () => {
      expect(isSafeExternalUrl('file:///etc/passwd').safe).toBe(false);
      expect(isSafeExternalUrl('javascript:alert(1)').safe).toBe(false);
      expect(isSafeExternalUrl('data:text/plain,hello').safe).toBe(false);
    });
  });

  describe('redactSecrets (Information Disclosure Defense)', () => {
    it('redacts explicit API keys from text', () => {
      const apiKey = ['sk-proj', 'abc123xyz789SECRET'].join('-');
      const raw = `Request failed with key: ${apiKey} at endpoint.`;
      const redacted = redactSecrets(raw, [apiKey]);
      expect(redacted).not.toContain(apiKey);
      expect(redacted).toContain('[REDACTED_SECRET]');
    });

    it('redacts query parameter API keys', () => {
      const dummyKey = ['AIzaSy', 'A1B2C3D4E5F6G7H8I9'].join('');
      const raw = `https://api.service.com/v1?api_key=${dummyKey}&query=test`;
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain(dummyKey);
      expect(redacted).toContain('api_key=[REDACTED_KEY]');
    });

    it('redacts authorization token headers', () => {
      const token = ['sk-ant', 'api03', 'abcdef1234567890'].join('-');
      const raw = `Authorization: ${'Bearer'} ${token}`;
      const redacted = redactSecrets(raw);
      expect(redacted).not.toContain(token);
      expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
    });
  });

  describe('validatePdfBuffer (Malicious File Defense)', () => {
    it('validates a correct %PDF- header', () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      // %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      view[0] = 0x25;
      view[1] = 0x50;
      view[2] = 0x44;
      view[3] = 0x46;
      view[4] = 0x2d;

      const res = validatePdfBuffer(buffer);
      expect(res.valid).toBe(true);
    });

    it('rejects files without valid PDF magic bytes', () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view[0] = 0x3c; // '<'
      view[1] = 0x68; // 'h'
      view[2] = 0x74; // 't'
      view[3] = 0x6d; // 'm'
      view[4] = 0x6c; // 'l'

      const res = validatePdfBuffer(buffer);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('missing %PDF- header');
    });

    it('rejects empty buffers or oversized files', () => {
      expect(validatePdfBuffer(new ArrayBuffer(0)).valid).toBe(false);
      const oversized = new ArrayBuffer(100);
      expect(validatePdfBuffer(oversized, 50).valid).toBe(false);
    });
  });

  describe('Declarative Net Request Hardening (setupOllamaDNRRules - QF-VULN-01)', () => {
    beforeEach(() => {
      resetMockDynamicRules();
    });

    it('generates dynamic rules scoped strictly to extension initiator domain', async () => {
      await setupOllamaDNRRules();

      expect(mockDynamicRules.length).toBeGreaterThanOrEqual(2);
      for (const rule of mockDynamicRules) {
        expect(rule.condition.initiatorDomains).toEqual(['mock-quickfiller-id']);
        expect(rule.action.type).toBe('modifyHeaders');
        expect(rule.action.requestHeaders).toBeDefined();
        // Crucial security check: must NOT inject access-control-allow-origin response headers
        expect(rule.action.responseHeaders).toBeUndefined();
      }
    });

    it('rewrites origin to match target Ollama endpoint for localhost and 127.0.0.1', async () => {
      await setupOllamaDNRRules();

      const localhostRule = mockDynamicRules.find((r) => r.condition.urlFilter.includes('localhost'));
      expect(localhostRule).toBeDefined();
      expect(localhostRule.action.requestHeaders[0]).toEqual({
        header: 'origin',
        operation: 'set',
        value: 'http://localhost:11434',
      });

      const loopbackRule = mockDynamicRules.find((r) => r.condition.urlFilter.includes('127.0.0.1'));
      expect(loopbackRule).toBeDefined();
      expect(loopbackRule.action.requestHeaders[0]).toEqual({
        header: 'origin',
        operation: 'set',
        value: 'http://127.0.0.1:11434',
      });
    });

    it('supports custom Ollama hosts and custom ports securely', async () => {
      await setupOllamaDNRRules('http://localhost:11435');

      const customRule = mockDynamicRules.find((r) => r.condition.urlFilter.includes('11435'));
      expect(customRule).toBeDefined();
      expect(customRule.condition.urlFilter).toBe('*://localhost:11435/*');
      expect(customRule.condition.initiatorDomains).toEqual(['mock-quickfiller-id']);
      expect(customRule.action.responseHeaders).toBeUndefined();
    });
  });

  describe('SSRF Post-Redirect Target Validation (QF-VULN-02)', () => {
    it('detects and rejects redirect destinations pointing to private IPv4', () => {
      const redirectedTargets = [
        'http://169.254.169.254/latest/meta-data/',
        'http://127.0.0.1:11434/api/tags',
        'http://10.0.0.1/admin',
        'http://192.168.1.1/router',
        'http://172.16.0.5/',
        'http://localhost:8080/secret',
      ];

      for (const target of redirectedTargets) {
        const check = isSafeExternalUrl(target);
        expect(check.safe).toBe(false);
        expect(check.error).toBeDefined();
      }
    });

    it('allows legitimate public redirected URLs', () => {
      const publicTargets = [
        'https://boards.greenhouse.io/stripe/jobs/123',
        'https://jobs.lever.co/company/456',
        'https://myworkdayjobs.com/company/job/789',
      ];

      for (const target of publicTargets) {
        const check = isSafeExternalUrl(target);
        expect(check.safe).toBe(true);
        expect(check.url).toBeDefined();
      }
    });
  });
});
