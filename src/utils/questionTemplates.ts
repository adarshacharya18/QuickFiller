import { QuestionCategory } from '../types/questions';

export interface QuestionTemplate {
  id: string;
  title: string;
  category: QuestionCategory;
  questionPrompt: string;
  placeholderAnswer: string;
  tags: string[];
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    id: 'tpl_intro',
    title: 'Elevator Pitch / Intro',
    category: 'behavioral',
    questionPrompt: 'Tell me about yourself and your background.',
    placeholderAnswer:
      'I am a full-stack engineer with experience building scalable web applications and high-performance services. Over the past few years, I have focused on modern TypeScript, React, and distributed backend systems, delivering user-facing impact and optimizing technical architecture.',
    tags: ['intro', 'elevator-pitch', 'background'],
  },
  {
    id: 'tpl_why_company',
    title: 'Why This Company?',
    category: 'company_specific',
    questionPrompt: 'Why are you interested in joining our company?',
    placeholderAnswer:
      'I admire your mission and technical bar. The opportunity to tackle large-scale challenges while collaborating with a talented, high-velocity engineering team aligns perfectly with my background and career aspirations.',
    tags: ['motivation', 'company-fit', 'culture'],
  },
  {
    id: 'tpl_challenging_project',
    title: 'Challenging Technical Project',
    category: 'technical',
    questionPrompt: 'Describe a challenging technical project you built, including architectural trade-offs.',
    placeholderAnswer:
      'I engineered an asynchronous data processing pipeline that handled real-time ingestion. The key trade-off was choosing between an in-memory queue versus a persistent event stream. I adopted a hybrid architecture with Redis caching and background worker pools, reducing latency by 45% while guaranteeing data consistency.',
    tags: ['technical', 'architecture', 'trade-offs'],
  },
  {
    id: 'tpl_conflict',
    title: 'Handling Conflict / Disagreement',
    category: 'behavioral',
    questionPrompt: 'Tell me about a time you had a technical disagreement with a team member and how you resolved it.',
    placeholderAnswer:
      'During a debate over API schemas, a teammate preferred REST while I advocated for GraphQL to prevent mobile over-fetching. Rather than arguing in isolation, I set up a lightweight benchmark comparing payload sizes and developer ergonomics. The objective data showed clear mobile bandwidth savings, and we agreed on a phased GraphQL rollout.',
    tags: ['conflict-resolution', 'teamwork', 'communication'],
  },
  {
    id: 'tpl_leadership',
    title: 'Technical Leadership / Mentorship',
    category: 'behavioral',
    questionPrompt: 'Describe your leadership style or an instance where you mentored another engineer.',
    placeholderAnswer:
      'I lead through clarity, architectural documentation, and empowering teammates. I regularly conduct empathetic code reviews, pair-program on complex bugs, and share architectural RFCs early to foster inclusive consensus.',
    tags: ['leadership', 'mentorship', 'collaboration'],
  },
  {
    id: 'tpl_salary',
    title: 'Compensation Expectations',
    category: 'compensation',
    questionPrompt: 'What are your compensation / salary expectations?',
    placeholderAnswer:
      'My salary expectation is competitive and aligns with market rates for a Senior Software Engineer, around $130,000 - $160,000 / year (or market equivalent), though I am open to discussing the full compensation package including equity and bonuses.',
    tags: ['salary', 'compensation', 'benefits'],
  },
  {
    id: 'tpl_notice',
    title: 'Notice Period & Availability',
    category: 'compensation',
    questionPrompt: 'What is your notice period or earliest possible start date?',
    placeholderAnswer:
      'I have a standard 2-week notice period (or immediate availability), and can transition smoothly upon receiving and accepting a formal offer.',
    tags: ['notice-period', 'availability', 'start-date'],
  },
];
