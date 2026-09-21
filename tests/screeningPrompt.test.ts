import { describe, it, expect } from 'vitest';
import { cleanAnswerOutput, buildSystemPrompt } from '../src/utils/llm/prompt';
import { defaultProfile, CandidateProfile } from '../src/types/profile';
import { defaultWizardAnswers } from '../src/types/questions';

describe('Screening Question LLM Engine & Sanitization', () => {
  describe('Raw Screening Answer Sanitization (cleanAnswerOutput)', () => {
    it('strips <screening_answer> tags cleanly', () => {
      const raw = `<screening_answer>
In my previous role at Universaltech, I built a real-time event pipeline processing over 100k events/sec.
</screening_answer>`;

      const cleaned = cleanAnswerOutput(raw);
      expect(cleaned).not.toContain('<screening_answer>');
      expect(cleaned).not.toContain('</screening_answer>');
      expect(cleaned).toBe(
        'In my previous role at Universaltech, I built a real-time event pipeline processing over 100k events/sec.'
      );
    });

    it('strips case-insensitive and attribute-bearing XML tags (<SCREENING_ANSWER>, <screening_answer id="1">)', () => {
      const raw1 = `<SCREENING_ANSWER>I am authorized to work in India.</SCREENING_ANSWER>`;
      expect(cleanAnswerOutput(raw1)).toBe('I am authorized to work in India.');

      const raw2 = `<screening_answer role="candidate">Yes, immediate start.</screening_answer>`;
      expect(cleanAnswerOutput(raw2)).toBe('Yes, immediate start.');
    });

    it('strips <answer>, <candidate_answer>, and <response> wrapper tags', () => {
      const variations = [
        '<answer>\n$140,000, 2 weeks notice\n</answer>',
        '<candidate_answer>\n$140,000, 2 weeks notice\n</candidate_answer>',
        '<response>\n$140,000, 2 weeks notice\n</response>',
        '<screening_question_answer>\n$140,000, 2 weeks notice\n</screening_question_answer>',
      ];

      for (const v of variations) {
        expect(cleanAnswerOutput(v)).toBe('$140,000, 2 weeks notice');
      }
    });

    it('handles unclosed or truncated XML tags gracefully', () => {
      const unclosed = '<screening_answer>I have 5+ years of full-stack engineering experience.';
      expect(cleanAnswerOutput(unclosed)).toBe('I have 5+ years of full-stack engineering experience.');

      const trailingOnly = 'I have 5+ years of full-stack engineering experience.</screening_answer>';
      expect(cleanAnswerOutput(trailingOnly)).toBe('I have 5+ years of full-stack engineering experience.');
    });

    it('strips markdown code blocks wrapping XML tags', () => {
      const raw = `\`\`\`xml
<screening_answer>
I hold a Bachelor of Technology degree in Computer Science.
</screening_answer>
\`\`\``;

      expect(cleanAnswerOutput(raw)).toBe(
        'I hold a Bachelor of Technology degree in Computer Science.'
      );
    });

    it('strips markdown code blocks without XML tags', () => {
      const raw = `\`\`\`text
Market Rate / Negotiable, Immediate availability.
\`\`\``;

      expect(cleanAnswerOutput(raw)).toBe('Market Rate / Negotiable, Immediate availability.');
    });

    it('strips conversational preambles and prefixes', () => {
      const variations = [
        'Here is the drafted answer for your screening question:\n\nIn my previous project Spic, I designed a low-latency voice engine.',
        'Certainly! Below is the answer:\n\nIn my previous project Spic, I designed a low-latency voice engine.',
        'Sure! Here is a drafted answer:\n\nIn my previous project Spic, I designed a low-latency voice engine.',
        'Answer: In my previous project Spic, I designed a low-latency voice engine.',
        'Drafted Answer: In my previous project Spic, I designed a low-latency voice engine.',
      ];

      for (const v of variations) {
        const cleaned = cleanAnswerOutput(v);
        expect(cleaned).not.toContain('Here is');
        expect(cleaned).not.toContain('Certainly!');
        expect(cleaned).not.toContain('Sure!');
        expect(cleaned).not.toContain('Answer:');
        expect(cleaned).toBe('In my previous project Spic, I designed a low-latency voice engine.');
      }
    });

    it('strips conversational outros and follow-up offers', () => {
      const raw = `In my previous role, I led the migration from Webpack to Vite.

I hope this helps! Let me know if you need any adjustments or more details.`;

      const cleaned = cleanAnswerOutput(raw);
      expect(cleaned).not.toContain('I hope this helps');
      expect(cleaned).not.toContain('Let me know if you need');
      expect(cleaned).toBe('In my previous role, I led the migration from Webpack to Vite.');
    });

    it('strips outer enclosing quotes while preserving internal quotes', () => {
      const quoted = '"Market Rate / Negotiable, Immediate"';
      expect(cleanAnswerOutput(quoted)).toBe('Market Rate / Negotiable, Immediate');

      const smartQuoted = '“$130,000 - $150,000”';
      expect(cleanAnswerOutput(smartQuoted)).toBe('$130,000 - $150,000');

      const internalQuotes = 'I built an open-source project called "Spic" for voice control.';
      expect(cleanAnswerOutput(internalQuotes)).toBe(
        'I built an open-source project called "Spic" for voice control.'
      );
    });

    it('preserves valid technical HTML/code tags inside candidate answers', () => {
      const rawWithHtml = `<screening_answer>
I have extensive experience working with <div>, <canvas>, and WebAudio API elements in modern browsers.
</screening_answer>`;

      const cleaned = cleanAnswerOutput(rawWithHtml);
      expect(cleaned).not.toContain('<screening_answer>');
      expect(cleaned).toContain('<div>');
      expect(cleaned).toContain('<canvas>');
      expect(cleaned).toBe(
        'I have extensive experience working with <div>, <canvas>, and WebAudio API elements in modern browsers.'
      );
    });

    it('handles empty, null, undefined, or whitespace-only inputs safely', () => {
      expect(cleanAnswerOutput('')).toBe('');
      expect(cleanAnswerOutput('   ')).toBe('');
      expect(cleanAnswerOutput(null as any)).toBe('');
      expect(cleanAnswerOutput(undefined as any)).toBe('');
    });

    it('preserves already clean answers without any modifications', () => {
      const cleanAnswer =
        'I have 4 years of software engineering experience specializing in React, TypeScript, and Go microservices.';
      expect(cleanAnswerOutput(cleanAnswer)).toBe(cleanAnswer);
    });
  });

  describe('Prompt Generation (buildSystemPrompt)', () => {
    it('includes explicit anti-XML wrapping constraints in system prompt', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          firstName: 'Adarsh',
          lastName: 'Acharya',
          email: 'adarsh@example.com',
        },
        skills: ['TypeScript', 'React', 'Go'],
      };

      const prompt = buildSystemPrompt(
        profile,
        defaultWizardAnswers,
        [],
        { title: 'Senior Software Engineer', company: 'Acme Corp' },
        []
      );

      expect(prompt).toContain('OUTPUT FORMAT & ZERO XML WRAPPING');
      expect(prompt).toContain('<screening_answer>');
      expect(prompt).toContain('NEVER wrap your answer in XML or HTML tags');
      expect(prompt).toContain('Produce pure plain text');
      expect(prompt).toContain('Adarsh');
      expect(prompt).toContain('Acme Corp');
    });
  });
});
