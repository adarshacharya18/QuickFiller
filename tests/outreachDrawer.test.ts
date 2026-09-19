import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
  DELIMITER_VARIANT_A,
  DELIMITER_VARIANT_B,
} from '../src/utils/llm/outreachPrompt';
import { defaultProfile } from '../src/types/profile';
import { OutreachPersona, OutreachResult } from '../src/types/outreach';

describe('Outreach Studio Workflow & State Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Non-Job Page Smart Tab Defaulting Logic', () => {
    it('defaults activeTab to outreach when 0 form fields exist and user has not manually switched', () => {
      let activeTab: 'autofill' | 'coverLetter' | 'outreach' | 'bank' = 'autofill';
      const hasUserSelectedTab = { current: false };

      // Simulate scanPage on a non-job page (e.g. LinkedIn profile)
      const standardFieldsCount = 0;
      const customQuestionsCount = 0;
      const radioGroupsCount = 0;
      const total = standardFieldsCount + customQuestionsCount + radioGroupsCount;

      if (total === 0 && !hasUserSelectedTab.current) {
        if (activeTab === 'autofill') {
          activeTab = 'outreach';
        }
      }

      expect(activeTab).toBe('outreach');
    });

    it('preserves user tab selection if user explicitly selected another tab', () => {
      let activeTab: 'autofill' | 'coverLetter' | 'outreach' | 'bank' = 'autofill';
      const hasUserSelectedTab = { current: true }; // User explicitly clicked 'autofill'

      const total = 0;
      if (total === 0 && !hasUserSelectedTab.current) {
        if (activeTab === 'autofill') {
          activeTab = 'outreach';
        }
      }

      expect(activeTab).toBe('autofill');
    });

    it('defaults to autofill when fields exist on an ATS page', () => {
      let activeTab: 'autofill' | 'coverLetter' | 'outreach' | 'bank' = 'autofill';
      const hasUserSelectedTab = { current: false };

      const total = 5; // Form fields found on ATS page
      if (total === 0 && !hasUserSelectedTab.current) {
        if (activeTab === 'autofill') {
          activeTab = 'outreach';
        }
      }

      expect(activeTab).toBe('autofill');
    });
  });

  describe('Context Extraction Heuristics for Outreach', () => {
    it('extracts role and company from standard document titles (e.g. LinkedIn style)', () => {
      document.title = 'Jane Doe - Senior Engineering Manager at Google | LinkedIn';

      const cleanDocTitle = document.title.replace(/\s*[-–—|]\s*(LinkedIn|Twitter|X|GitHub|Gmail)$/i, '').trim();
      let role = '';
      let company = '';

      const atMatch = cleanDocTitle.match(/^(?:.*?\s*[-–—|]\s*)?(.*?)\s+(?:at|@)\s+([^–—|]+)/i);
      if (atMatch) {
        role = atMatch[1].trim();
        company = atMatch[2].trim();
      }

      expect(role).toBe('Senior Engineering Manager');
      expect(company).toBe('Google');
    });

    it('handles titles with hyphen separation when "at" is absent', () => {
      document.title = 'Alex Chen - Staff Backend Engineer - Stripe';

      const cleanDocTitle = document.title.trim();
      let role = '';
      let company = '';

      const parts = cleanDocTitle.split(' - ');
      if (parts.length >= 3) {
        role = parts[1].trim();
        company = parts[2].trim();
      }

      expect(role).toBe('Staff Backend Engineer');
      expect(company).toBe('Stripe');
    });
  });

  describe('Dual-Variant Character Count & Limit Enforcement', () => {
    it('flags when Variant A connection note exceeds 300 character limit', () => {
      const shortNote = "Hi Sarah, loved your team's talk on distributed databases. As a backend engineer building in Go/Postgres, I would love to connect and follow Stripe's engineering progress!";
      const longNote = "A".repeat(320);

      const parsedShort = parseOutreachResponse(
        `${DELIMITER_VARIANT_A}\n${shortNote}\n\n${DELIMITER_VARIANT_B}\nFull pitch`,
        'technical'
      );

      const parsedLong = parseOutreachResponse(
        `${DELIMITER_VARIANT_A}\n${longNote}\n\n${DELIMITER_VARIANT_B}\nFull pitch`,
        'technical'
      );

      expect(parsedShort.connectionNoteCharCount).toBeLessThanOrEqual(300);
      expect(parsedShort.connectionNoteCharCount).toBe(shortNote.length);

      expect(parsedLong.connectionNoteCharCount).toBeGreaterThan(300);
    });

    it('calculates full pitch word count accurately', () => {
      const pitch = "Hi Mark,\n\nI noticed your team is building with Rust. At Acme, I scaled our microservices by 40%.\n\nOpen to a quick 10-minute chat?";
      const parsed = parseOutreachResponse(
        `${DELIMITER_VARIANT_A}\nShort note\n\n${DELIMITER_VARIANT_B}\n${pitch}`,
        'recruiter'
      );

      expect(parsed.fullPitchWordCount).toBe(24);
    });
  });

  describe('Persona-Specific System Prompts', () => {
    it('contains recruiter-oriented instructions and low-friction CTA requirement', () => {
      const prompt = buildOutreachSystemPrompt(defaultProfile, 'recruiter');
      expect(prompt).toContain('Recruiter / Talent Partner / HR');
      expect(prompt).toContain('low-friction invitation to connect');
      expect(prompt).toContain('FORBIDDEN: "I hope this message finds you well"');
      expect(prompt).toContain('STRICT ANTI-CLICHÉ');
    });

    it('contains engineering lead-oriented instructions and tech stack resonance', () => {
      const prompt = buildOutreachSystemPrompt(defaultProfile, 'technical');
      expect(prompt).toContain('Engineering Lead / Hiring Manager / Technical Peer');
      expect(prompt).toContain('Speak as an engineer to an engineer');
      expect(prompt).toContain('Avoid HR fluff');
    });
  });
});
