import { describe, it, expect } from 'vitest';
import {
  cleanCoverLetterOutput,
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from '../src/utils/llm/coverLetterPrompt';
import { defaultProfile, CandidateProfile } from '../src/types/profile';

describe('Cover Letter Prompt & Post-Processing Engine', () => {
  describe('Raw Cover Letter Sanitization (cleanCoverLetterOutput)', () => {
    it('strips conversational opening headers (Regression User Request #3)', () => {
      const rawOutput = `Here is a tailored cover letter for the JavaScript Developer role at MailerMen:

Dear Hiring Team at MailerMen,

I am writing to express my strong interest in the JavaScript Developer position. With over 5 years of experience building modern web applications, I am excited about contributing to your team.

Sincerely,
Adarsh Acharya`;

      const cleaned = cleanCoverLetterOutput(rawOutput);

      // Must strip the conversational "Here is a tailored cover letter..." line completely
      expect(cleaned).not.toContain('Here is a tailored cover letter');
      expect(cleaned).toContain('Dear Hiring Team at MailerMen,');
      expect(cleaned).toContain('Sincerely,\nAdarsh Acharya');
    });

    it('strips typical conversational AI variations', () => {
      const variations = [
        'Certainly! Here is your cover letter:\n\nDear Team,\n\nBody',
        'Here is the requested cover letter tailored to your profile:\n\nDear Hiring Manager,\n\nBody',
        'Sure! Below is the cover letter:\n\nDear Team,\n\nBody',
      ];

      for (const v of variations) {
        const cleaned = cleanCoverLetterOutput(v);
        expect(cleaned.startsWith('Dear')).toBe(true);
      }
    });

    it('strips trailing conversational closings and offers for edits', () => {
      const rawOutput = `Dear Hiring Team,

I am excited to apply for the position.

Sincerely,
John Doe

I hope this helps! Let me know if you need any revisions or tweaks.`;

      const cleaned = cleanCoverLetterOutput(rawOutput);
      expect(cleaned).not.toContain('I hope this helps');
      expect(cleaned).not.toContain('Let me know if you need any revisions');
      expect(cleaned.trim().endsWith('John Doe')).toBe(true);
    });

    it('preserves clean letters that are already raw', () => {
      const cleanInput = `Dear Hiring Manager,

I am writing to apply for the Frontend Engineer position at LeadSquared.

Best regards,
Adarsh`;

      const result = cleanCoverLetterOutput(cleanInput);
      expect(result).toBe(cleanInput);
    });
  });

  describe('Prompt Generation (buildCoverLetterSystemPrompt & buildCoverLetterUserPrompt)', () => {
    it('constructs system prompt with candidate profile and strict raw output rules', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          firstName: 'Adarsh',
          lastName: 'Acharya',
          email: 'adarsh@example.com',
          phone: '+91 9876543210',
          githubUrl: 'https://github.com/adarshacharya18',
        },
        skills: ['TypeScript', 'React', 'Angular', 'Node.js'],
      };

      const systemPrompt = buildCoverLetterSystemPrompt(profile);

      expect(systemPrompt).toContain('Adarsh');
      expect(systemPrompt).toContain('Acharya');
      expect(systemPrompt).toContain('TypeScript');
      expect(systemPrompt).toContain('FORMATTING & RAW OUTPUT');
      expect(systemPrompt).toContain('ABSOLUTE PROHIBITION ON PREAMBLES');
      expect(systemPrompt).toContain('Here is a tailored cover letter');
    });

    it('constructs user prompt with target company, role, and job description', () => {
      const userPrompt = buildCoverLetterUserPrompt({
        company: 'LeadSquared',
        role: 'Senior Frontend Engineer',
        jobDescription: 'Looking for a Senior Frontend Engineer with TypeScript and Angular experience.',
        tone: 'technical',
        length: 'concise',
      });

      expect(userPrompt).toContain('LeadSquared');
      expect(userPrompt).toContain('Senior Frontend Engineer');
      expect(userPrompt).toContain('Looking for a Senior Frontend Engineer');
      expect(userPrompt).toContain('Technical and architecture-focused');
      expect(userPrompt).toContain('concise');
    });
  });
});
