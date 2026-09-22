import { describe, it, expect, vi } from 'vitest';
import {
  classifyResumeUrl,
  extractCandidateName,
  matchSectionHeader,
  parseResumeSections,
  parseExperience,
  parseProjects,
  parseSkills,
  parseEducation,
  extractCity,
  reconstructTextWithLines,
} from '../src/utils/pdfParser';

describe('PDF Parser & Resume Extractor', () => {
  describe('classifyResumeUrl', () => {
    it('classifies GitHub profiles correctly', () => {
      const res = classifyResumeUrl('https://github.com/adarshacharya');
      expect(res.category).toBe('github');
      expect(res.isProfile).toBe(true);
      expect(res.username).toBe('adarshacharya');
    });

    it('classifies GitHub repositories as projects', () => {
      const res = classifyResumeUrl('https://github.com/adarshacharya/QuickFiller');
      expect(res.category).toBe('project');
      expect(res.isProfile).toBe(false);
      expect(res.username).toBe('adarshacharya');
    });

    it('ignores GitHub reserved paths', () => {
      const res = classifyResumeUrl('https://github.com/features');
      expect(res.category).toBe('other');
      expect(res.isProfile).toBe(false);
    });

    it('classifies LinkedIn profiles correctly', () => {
      const res = classifyResumeUrl('https://www.linkedin.com/in/adarsh-acharya');
      expect(res.category).toBe('linkedin');
      expect(res.isProfile).toBe(true);
    });

    it('classifies personal portfolio domains as portfolio', () => {
      expect(classifyResumeUrl('https://adarshacharya.dev').category).toBe('portfolio');
      expect(classifyResumeUrl('https://myportfolio.me').category).toBe('portfolio');
      expect(classifyResumeUrl('https://adarsh.github.io').category).toBe('portfolio');
      expect(classifyResumeUrl('https://my-app.vercel.app').category).toBe('portfolio');
    });

    it('classifies general web domains as other rather than project', () => {
      expect(classifyResumeUrl('https://company.com').category).toBe('other');
      expect(classifyResumeUrl('https://medium.com/@adarsh/my-article').category).toBe('other');
      expect(classifyResumeUrl('https://stanford.edu').category).toBe('other');
      expect(classifyResumeUrl('https://coursera.org/verify/123').category).toBe('other');
    });
  });

  describe('reconstructTextWithLines', () => {
    it('reconstructs lines using vertical delta (y-coordinate) changes', () => {
      const items = [
        { str: 'John Doe', transform: [1, 0, 0, 1, 50, 750], width: 60, hasEOL: false },
        { str: 'Software Engineer', transform: [1, 0, 0, 1, 50, 730], width: 110, hasEOL: false },
        { str: 'WORK EXPERIENCE', transform: [1, 0, 0, 1, 50, 700], width: 120, hasEOL: false },
        { str: 'Google', transform: [1, 0, 0, 1, 50, 680], width: 40, hasEOL: false },
        { str: '|', transform: [1, 0, 0, 1, 95, 680], width: 5, hasEOL: false },
        { str: 'Senior SDE', transform: [1, 0, 0, 1, 105, 680], width: 70, hasEOL: false },
      ];

      const text = reconstructTextWithLines(items);
      expect(text).toContain('John Doe\nSoftware Engineer\nWORK EXPERIENCE\nGoogle | Senior SDE');
    });

    it('respects hasEOL flag even when y-coordinate does not change', () => {
      const items = [
        { str: 'Line 1', transform: [1, 0, 0, 1, 50, 700], width: 40, hasEOL: true },
        { str: 'Line 2', transform: [1, 0, 0, 1, 50, 700], width: 40, hasEOL: false },
      ];

      const text = reconstructTextWithLines(items);
      expect(text).toBe('Line 1\nLine 2');
    });

    it('adds space between words on the same line if gap exists', () => {
      const items = [
        { str: 'React', transform: [1, 0, 0, 1, 50, 500], width: 30, hasEOL: false },
        { str: 'TypeScript', transform: [1, 0, 0, 1, 90, 500], width: 60, hasEOL: false },
      ];

      const text = reconstructTextWithLines(items);
      expect(text).toBe('React TypeScript');
    });
  });

  describe('matchSectionHeader & parseResumeSections', () => {
    it('matches experience headers across common variations and punctuation', () => {
      expect(matchSectionHeader('WORK EXPERIENCE')).toBe('experience');
      expect(matchSectionHeader('Work Experience:')).toBe('experience');
      expect(matchSectionHeader('PROFESSIONAL EXPERIENCE')).toBe('experience');
      expect(matchSectionHeader('EMPLOYMENT HISTORY')).toBe('experience');
      expect(matchSectionHeader('Employment History:')).toBe('experience');
      expect(matchSectionHeader('Work History')).toBe('experience');
      expect(matchSectionHeader('Relevant Experience')).toBe('experience');
      expect(matchSectionHeader('## WORK EXPERIENCE')).toBe('experience');
      expect(matchSectionHeader('| Experience |')).toBe('experience');
      expect(matchSectionHeader('1. Experience')).toBe('experience');
      expect(matchSectionHeader('E X P E R I E N C E')).toBe('experience');
      expect(matchSectionHeader('Internship Experience')).toBe('experience');
    });

    it('matches project headers across variations', () => {
      expect(matchSectionHeader('PROJECTS')).toBe('projects');
      expect(matchSectionHeader('Key Projects:')).toBe('projects');
      expect(matchSectionHeader('Personal Projects')).toBe('projects');
      expect(matchSectionHeader('Technical Projects')).toBe('projects');
      expect(matchSectionHeader('Academic Projects')).toBe('projects');
      expect(matchSectionHeader('Featured Projects')).toBe('projects');
    });

    it('matches education headers across variations', () => {
      expect(matchSectionHeader('EDUCATION')).toBe('education');
      expect(matchSectionHeader('Academic Background')).toBe('education');
      expect(matchSectionHeader('Education & Qualifications')).toBe('education');
      expect(matchSectionHeader('Education:')).toBe('education');
    });

    it('matches skills headers across variations', () => {
      expect(matchSectionHeader('SKILLS')).toBe('skills');
      expect(matchSectionHeader('Technical Skills:')).toBe('skills');
      expect(matchSectionHeader('Core Competencies')).toBe('skills');
      expect(matchSectionHeader('Skills & Technologies')).toBe('skills');
    });

    it('does not falsely classify bullet points or sentences as headers', () => {
      expect(matchSectionHeader('5 years of professional experience in full stack development')).toBeNull();
      expect(matchSectionHeader('Led projects using React and Node.js')).toBeNull();
      expect(matchSectionHeader('Possess strong communication skills')).toBeNull();
    });

    it('correctly splits text into sections when header has punctuation or variants', () => {
      const resume = `
John Doe
Software Engineer
john@doe.com

EMPLOYMENT HISTORY:
Google
Software Engineer
01/2021 - Present
• Built high-performance cloud services.

PROJECTS:
QuickFiller
• Browser copilot extension.

TECHNICAL SKILLS:
TypeScript, React, Python, Go

EDUCATION:
Stanford University
BS Computer Science
2016 - 2020
      `;

      const sections = parseResumeSections(resume);
      expect(sections.experience).toBeDefined();
      expect(sections.experience.length).toBeGreaterThan(0);
      expect(sections.experience.some((l) => l.includes('Google'))).toBe(true);

      expect(sections.projects).toBeDefined();
      expect(sections.projects.some((l) => l.includes('QuickFiller'))).toBe(true);

      expect(sections.skills).toBeDefined();
      expect(sections.education).toBeDefined();
    });
  });

  describe('parseExperience', () => {
    it('parses standard Month Year - Present date format', () => {
      const lines = [
        'Google - Senior Software Engineer',
        'Jan 2021 - Present',
        '• Architected microservices serving millions of requests.',
        '• Mentored 4 junior engineers.',
      ];

      const exps = parseExperience(lines);
      expect(exps).toHaveLength(1);
      expect(exps[0].company).toBe('Google');
      expect(exps[0].role).toBe('Senior Software Engineer');
      expect(exps[0].startDate).toBe('Jan 2021');
      expect(exps[0].endDate).toBe('Present');
      expect(exps[0].highlights).toHaveLength(2);
    });

    it('parses numeric date formats like MM/YYYY - MM/YYYY and en-dashes', () => {
      const lines = [
        'Amazon',
        'Backend Engineer',
        '05/2019 – 12/2021',
        '• Maintained AWS infrastructure.',
      ];

      const exps = parseExperience(lines);
      expect(exps).toHaveLength(1);
      expect(exps[0].company).toBe('Amazon');
      expect(exps[0].role).toBe('Backend Engineer');
      expect(exps[0].startDate).toBe('05/2019');
      expect(exps[0].endDate).toBe('12/2021');
      expect(exps[0].highlights).toHaveLength(1);
    });

    it('parses YYYY/MM - Current and Till Date formats', () => {
      const lines = [
        'Shopify | Lead Developer | 2021/04 – Current',
        '• Led payment infrastructure revamp.',
      ];

      const exps = parseExperience(lines);
      expect(exps).toHaveLength(1);
      expect(exps[0].company).toBe('Shopify');
      expect(exps[0].role).toBe('Lead Developer');
      expect(exps[0].startDate).toBe('2021/04');
      expect(exps[0].endDate).toBe('Current');
    });

    it('parses multiple work experience entries cleanly', () => {
      const lines = [
        'Stripe - Staff Engineer (San Francisco, CA)',
        'March 2022 - Present',
        '• Built cross-border payment rails.',
        'Meta - Software Engineer',
        '06/2018 - 02/2022',
        '• Developed Graph API endpoints.',
      ];

      const exps = parseExperience(lines);
      expect(exps).toHaveLength(2);
      expect(exps[0].company).toBe('Stripe');
      expect(exps[0].role).toBe('Staff Engineer');
      expect(exps[0].startDate).toBe('March 2022');
      expect(exps[0].endDate).toBe('Present');

      expect(exps[1].company).toBe('Meta');
      expect(exps[1].role).toBe('Software Engineer');
      expect(exps[1].startDate).toBe('06/2018');
      expect(exps[1].endDate).toBe('02/2022');
    });

    it('falls back to extracting role and company when dates are non-standard', () => {
      const lines = [
        'Frontend Developer at Acme Corp',
        '• Built responsive Web UI with React.',
        '• Optimized web performance.',
      ];

      const exps = parseExperience(lines);
      expect(exps).toHaveLength(1);
      expect(exps[0].role).toContain('Frontend Developer');
      expect(exps[0].company).toContain('Acme Corp');
      expect(exps[0].highlights).toHaveLength(2);
    });
  });

  describe('parseProjects', () => {
    it('extracts projects, descriptions, and detects technologies from text', () => {
      const lines = [
        'QuickFiller | https://github.com/adarshacharya/QuickFiller',
        '• An AI copilot browser extension built with React, TypeScript, and Vite.',
        '• Features local LLM Ollama integration and ATS scanner.',
        'Spic Voice Input',
        '• High performance voice dictation using Python, PipeWire, and faster-whisper.',
      ];

      const links = [
        { url: 'https://github.com/adarshacharya/QuickFiller', category: 'project' as const },
      ];

      const projs = parseProjects(lines, links);
      expect(projs).toHaveLength(2);

      expect(projs[0].title).toBe('QuickFiller');
      expect(projs[0].githubUrl).toBe('https://github.com/adarshacharya/QuickFiller');
      expect(projs[0].technologies).toContain('React');
      expect(projs[0].technologies).toContain('TypeScript');
      expect(projs[0].technologies).toContain('Vite');

      expect(projs[1].title).toBe('Spic Voice Input');
      expect(projs[1].technologies).toContain('Python');
    });

    it('extracts explicit Tech Stack / Technologies lines', () => {
      const lines = [
        'Cloud Deployer',
        'Technologies: Docker, Kubernetes, AWS, Go',
        '• Containerized microservice deployment automation.',
      ];

      const projs = parseProjects(lines, []);
      expect(projs).toHaveLength(1);
      expect(projs[0].title).toBe('Cloud Deployer');
      expect(projs[0].technologies).toContain('Docker');
      expect(projs[0].technologies).toContain('Kubernetes');
      expect(projs[0].technologies).toContain('AWS');
      expect(projs[0].technologies).toContain('Go');
    });
  });

  describe('parseSkills', () => {
    it('parses skill categories and bullet points accurately', () => {
      const lines = [
        'Languages: JavaScript, TypeScript, Python, Go, C++',
        'Frameworks: React, Next.js, Express, FastAPI',
        '• Docker, Kubernetes, AWS, PostgreSQL, Redis',
      ];

      const skills = parseSkills(lines);
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('Python');
      expect(skills).toContain('React');
      expect(skills).toContain('Docker');
      expect(skills).toContain('Kubernetes');
    });
  });

  describe('parseEducation', () => {
    it('parses institution, degree, and graduation year', () => {
      const lines = [
        'Stanford University',
        'Bachelor of Science in Computer Science, 2016 - 2020',
      ];

      const edu = parseEducation(lines);
      expect(edu).toHaveLength(1);
      expect(edu[0].institution).toBe('Stanford University');
      expect(edu[0].degree).toContain('Bachelor of Science');
      expect(edu[0].graduationYear).toBe('2020');
    });
  });

  describe('extractCity', () => {
    it('extracts city from header line using known cities or City, State format', () => {
      expect(extractCity(['San Francisco, CA | 555-1234'], 'test@test.com', '555-1234')).toBe('San Francisco');
      expect(extractCity(['Austin, TX'], 'test@test.com', '')).toBe('Austin');
      expect(extractCity(['Bengaluru, India'], 'test@test.com', '')).toBe('Bengaluru');
    });
  });

  describe('End-to-End Section & Data Flow Validation', () => {
    it('prevents multiple phantom projects and ensures experience is populated', () => {
      // Realistic resume text that previously failed in Firefox due to "EMPLOYMENT HISTORY" header and MM/YYYY dates
      const fullResume = `
John Doe
Software Engineer
john.doe@example.com | (555) 019-2834 | Seattle, WA
https://linkedin.com/in/johndoe | https://github.com/johndoe

EMPLOYMENT HISTORY

Amazon - Senior Software Engineer
03/2021 - Present
• Designed resilient streaming data pipelines using Apache Kafka and Go.
• Improved throughput by 45% while reducing compute cost.

Microsoft - Software Engineer
08/2018 - 02/2021
• Developed React components for Azure Cloud Portal.
• Built automated CI/CD validation pipelines.

KEY PROJECTS

QuickFiller | https://github.com/johndoe/QuickFiller
• Smart job application autofill copilot for browser.

TECHNICAL SKILLS
Go, TypeScript, React, Kafka, Docker, Kubernetes, AWS, Azure

EDUCATION
University of Washington
BS in Computer Science
2014 - 2018
      `;

      const sections = parseResumeSections(fullResume);
      expect(sections.experience).toBeDefined();
      expect(sections.experience.length).toBeGreaterThan(0);

      const experiences = parseExperience(sections.experience);
      expect(experiences).toHaveLength(2);
      expect(experiences[0].company).toBe('Amazon');
      expect(experiences[0].role).toBe('Senior Software Engineer');
      expect(experiences[0].startDate).toBe('03/2021');
      expect(experiences[0].endDate).toBe('Present');

      expect(experiences[1].company).toBe('Microsoft');
      expect(experiences[1].role).toBe('Software Engineer');
      expect(experiences[1].startDate).toBe('08/2018');
      expect(experiences[1].endDate).toBe('02/2021');

      const extractedLinks = [
        { url: 'https://linkedin.com/in/johndoe', category: 'linkedin' as const },
        { url: 'https://github.com/johndoe', category: 'github' as const },
        { url: 'https://github.com/johndoe/QuickFiller', category: 'project' as const },
      ];

      const projects = parseProjects(sections.projects, extractedLinks);
      expect(projects).toHaveLength(1);
      expect(projects[0].title).toBe('QuickFiller');
      expect(projects[0].githubUrl).toBe('https://github.com/johndoe/QuickFiller');
    });
  });
});
