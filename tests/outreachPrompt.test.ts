import { describe, it, expect } from 'vitest';
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
} from '../src/utils/llm/outreachPrompt';
import { CandidateProfile } from '../src/types/profile';
import { OutreachOptions } from '../src/types/outreach';

const mockProfile: CandidateProfile = {
  personal: {
    firstName: 'Alex',
    lastName: 'Chen',
    email: 'alex@example.com',
    phone: '555-0199',
    city: 'San Francisco',
    state: 'CA',
    linkedinUrl: 'https://linkedin.com/in/alexchen',
    githubUrl: 'https://github.com/alexchen',
    portfolioUrl: 'https://alexchen.dev',
  },
  education: [
    {
      institution: 'UC Berkeley',
      degree: 'B.S.',
      fieldOfStudy: 'Computer Science',
      graduationYear: '2023',
    },
  ],
  experience: [
    {
      company: 'Acme Cloud',
      role: 'Full Stack Engineer',
      startDate: '2023',
      endDate: 'Present',
      highlights: ['Built distributed microservices in Go and React', 'Reduced API latency by 40%'],
    },
  ],
  skills: ['TypeScript', 'React', 'Go', 'PostgreSQL', 'Docker'],
  portfolioDetails: {
    url: 'https://alexchen.dev',
    featuredProjects: [
      {
        title: 'TaskStream',
        description: 'Real-time collaborative task runner with WebSockets',
        technologies: ['TypeScript', 'Node.js', 'Redis'],
        url: 'https://github.com/alexchen/taskstream',
      },
    ],
  },
  customScreeningAnswers: {},
  rawResumeText: '',
};

describe('Outreach Prompt Engineering & Response Parser', () => {
  describe('buildOutreachSystemPrompt', () => {
    it('generates system prompt for Recruiter persona with candidate background and anti-cliché rules', () => {
      const prompt = buildOutreachSystemPrompt(mockProfile, 'recruiter');

      expect(prompt).toContain('Alex Chen');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Recruiter');
      expect(prompt).toContain('ANTI-CLICHÉ');
      expect(prompt).toContain('300 characters');
      expect(prompt).toContain('=== VARIANT A: CONNECTION NOTE ===');
      expect(prompt).toContain('=== VARIANT B: HIGH-IMPACT PITCH ===');
      expect(prompt).toContain('hope this message finds you well');
    });

    it('generates system prompt for Technical persona emphasizing engineering nuances', () => {
      const prompt = buildOutreachSystemPrompt(mockProfile, 'technical');

      expect(prompt).toContain('Alex Chen');
      expect(prompt).toContain('Engineering Lead');
      expect(prompt).toContain('tech stack');
      expect(prompt).toContain('TaskStream');
    });
  });

  describe('buildOutreachUserPrompt', () => {
    it('constructs user prompt with raw draft and optional context', () => {
      const options: OutreachOptions = {
        rawDraft: 'hey saw your team uses go and rust, saw the staff backend opening, wanted to reach out',
        persona: 'technical',
        company: 'Stripe',
        role: 'Staff Backend Engineer',
        contextNotes: 'Saw your tech blog on distributed database migration',
        candidateProfile: mockProfile,
      };

      const prompt = buildOutreachUserPrompt(options);

      expect(prompt).toContain('hey saw your team uses go and rust');
      expect(prompt).toContain('Target Company: Stripe');
      expect(prompt).toContain('Target Role: Staff Backend Engineer');
      expect(prompt).toContain('Additional Context: Saw your tech blog on distributed database migration');
    });

    it('handles minimal options when company and context are not provided', () => {
      const options: OutreachOptions = {
        rawDraft: 'reaching out about engineering opportunities',
        persona: 'recruiter',
        candidateProfile: mockProfile,
      };

      const prompt = buildOutreachUserPrompt(options);
      expect(prompt).toContain('reaching out about engineering opportunities');
      expect(prompt).not.toContain('Target Company: undefined');
    });
  });

  describe('parseOutreachResponse', () => {
    it('cleanly parses standard delimited response into Variant A and Variant B with metrics', () => {
      const rawOutput = `
Here are the refined messages for your outreach:

=== VARIANT A: CONNECTION NOTE ===
Hi Sarah, loved your team's work on Stripe's ledger architecture. I'm a full-stack engineer building high-throughput systems in Go/TypeScript at Acme. Would love to connect and follow your engineering updates!

=== VARIANT B: HIGH-IMPACT PITCH ===
Hi Sarah,

I came across Stripe's recent engineering post on database scaling and was thoroughly impressed with how your team addressed distributed transaction isolation.

As a Full Stack Engineer at Acme Cloud, I've spent the past two years designing low-latency Go microservices and scaling Redis pipelines, reducing end-to-end API latency by 40%. Given your team's current focus on reliable payment rails, I would welcome the opportunity to share how my background in distributed systems aligns with your engineering roadmap.

Are you open to a brief 10-minute technical exchange next week?
      `;

      const result = parseOutreachResponse(rawOutput, 'technical');

      expect(result.persona).toBe('technical');
      expect(result.connectionNote).toContain("Hi Sarah, loved your team's work on Stripe's ledger architecture");
      expect(result.connectionNote.length).toBeLessThanOrEqual(300);
      expect(result.connectionNoteCharCount).toBe(result.connectionNote.length);

      expect(result.fullPitch).toContain("Hi Sarah,");
      expect(result.fullPitch).toContain("low-latency Go microservices");
      expect(result.fullPitchWordCount).toBeGreaterThan(30);
    });

    it('handles markdown code block wrappers around delimiters', () => {
      const rawOutput = "```text\n=== VARIANT A: CONNECTION NOTE ===\nHi Alex, noticed your team is expanding. Let's connect!\n\n=== VARIANT B: HIGH-IMPACT PITCH ===\nHi Alex,\n\nI noticed your team is expanding. Let's talk soon.\n```";

      const result = parseOutreachResponse(rawOutput, 'recruiter');

      expect(result.connectionNote).toBe("Hi Alex, noticed your team is expanding. Let's connect!");
      expect(result.fullPitch).toContain("I noticed your team is expanding.");
    });

    it('handles JSON response format if returned by structured LLM', () => {
      const rawOutput = JSON.stringify({
        connectionNote: "Hi Mark, saw your post on Kubernetes migrations. Would love to connect!",
        fullPitch: "Hi Mark,\n\nSaw your post on Kubernetes migrations. Our team solved a similar challenge at Acme. Would love to connect.",
      });

      const result = parseOutreachResponse(rawOutput, 'technical');

      expect(result.connectionNote).toBe("Hi Mark, saw your post on Kubernetes migrations. Would love to connect!");
      expect(result.fullPitch).toContain("Our team solved a similar challenge");
    });

    it('gracefully falls back when output does not contain standard delimiters', () => {
      const rawOutput = "Hi Sarah, I noticed you are hiring for a Backend Engineer. I would love to connect and discuss how my Go experience can help Stripe.";

      const result = parseOutreachResponse(rawOutput, 'recruiter');

      expect(result.connectionNote.length).toBeGreaterThan(0);
      expect(result.fullPitch.length).toBeGreaterThan(0);
    });
  });
});
