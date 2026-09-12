import { CandidateProfile } from '../../types/profile';
import { CustomPasteItem } from '../../types/storage';

export interface CoverLetterOptions {
  company?: string;
  role?: string;
  jobDescription: string;
  tone?: 'professional' | 'technical' | 'startup';
  length?: 'concise' | 'standard' | 'detailed';
  customNote?: string;
  customPasteBank?: CustomPasteItem[];
}

/**
 * Builds the system prompt for cover letter generation with strict anti-hallucination grounding.
 */
export function buildCoverLetterSystemPrompt(
  profile: CandidateProfile,
  customPasteBank: CustomPasteItem[] = []
): string {
  const projectsList = profile.portfolioDetails.featuredProjects
    .filter((p) => p.title && (p.description || p.url))
    .map(
      (p) =>
        `- ${p.title}: ${p.description || 'Project'}${
          p.technologies?.length ? ` (Tech Stack: ${p.technologies.join(', ')})` : ''
        }${p.url ? ` [Link: ${p.url}]` : ''}`
    )
    .join('\n');

  const experienceList = profile.experience
    .filter((e) => e.company || e.role)
    .map(
      (e) =>
        `- ${e.role} at ${e.company} (${e.startDate || 'N/A'} - ${e.endDate || 'Present'}):\n  ${(
          e.highlights || []
        )
          .map((h) => `• ${h}`)
          .join('\n  ')}`
    )
    .join('\n');

  const educationList = profile.education
    .filter((ed) => ed.institution || ed.degree)
    .map(
      (ed) =>
        `- ${ed.degree}${ed.fieldOfStudy ? ` in ${ed.fieldOfStudy}` : ''}, ${ed.institution}${
          ed.graduationYear ? ` (${ed.graduationYear})` : ''
        }`
    )
    .join('\n');

  const pasteBankSnippets = (customPasteBank || [])
    .filter((item) => item.label && item.value)
    .map((item) => `- ${item.label}: "${item.value}"`)
    .join('\n');

  return `You are QuickFiller Cover Letter Copilot, an expert career strategist.
Your task is to write an exceptional, compelling, authentic, and tailored cover letter for a candidate applying to a role.

CANDIDATE INFORMATION:
- Name: ${profile.personal.firstName} ${profile.personal.lastName}
- Email: ${profile.personal.email || 'N/A'}
- Phone: ${profile.personal.phone || 'N/A'}
- Location: ${profile.personal.city || ''}${profile.personal.state ? `, ${profile.personal.state}` : ''}
- Portfolio: ${profile.personal.portfolioUrl || profile.portfolioDetails.url || 'N/A'} (Note: Personal portfolio website, NOT an employer)
- GitHub: ${profile.personal.githubUrl || 'N/A'}
- LinkedIn: ${profile.personal.linkedinUrl || 'N/A'}

CORE SKILLS:
${profile.skills.join(', ') || 'Software Development, Problem Solving'}

VERIFIED PORTFOLIO PROJECTS:
${projectsList || 'None listed'}

PROFESSIONAL EXPERIENCE:
${experienceList || 'None listed'}

EDUCATION:
${educationList || 'None listed'}

${profile.rawResumeText ? `RESUME CONTEXT:\n${profile.rawResumeText.slice(0, 2500)}\n` : ''}

REUSABLE SNIPPETS & HOOKS:
${pasteBankSnippets || 'None listed'}

CRITICAL RULES & GUIDELINES:
1. FIRST-PERSON VOICE: Always write in first person ("I am eager to contribute...", "In my recent project...").
2. ANTI-HALLUCINATION POLICY:
   - ONLY cite the candidate's actual projects, verified skills, and experience listed above.
   - NEVER invent employers, job titles, or metrics that do not exist in the candidate's profile.
   - Never confuse a personal portfolio URL for a previous company.
3. TAILORING TO THE JOB DESCRIPTION:
   - Connect 2-3 specific requirements or challenges mentioned in the Job Description directly to candidate's verified projects or experience.
   - Speak directly to the company's product, engineering ethos, or mission.
4. NO PLACEHOLDER BRACKETS:
   - Do NOT leave placeholders like "[Company Name]", "[Insert Date]", "[Hiring Manager Name]", or "[Your Phone]".
   - Fill actual names or omit bracketed boilerplate completely.
5. FORMATTING:
   - Output clean, ready-to-paste text (paragraphs separated by blank lines).
   - Do NOT wrap in conversational intro/outro (do NOT say "Here is your cover letter:"). Output only the cover letter.`;
}

/**
 * Builds the user prompt specifying target role, company, job description, and stylistic options.
 */
export function buildCoverLetterUserPrompt(options: CoverLetterOptions): string {
  const {
    company = 'the target company',
    role = 'the position',
    jobDescription,
    tone = 'professional',
    length = 'standard',
    customNote = '',
  } = options;

  let lengthDirective = 'around 300-350 words across 3 to 4 focused paragraphs';
  if (length === 'concise') {
    lengthDirective = 'concise and punchy, approximately 180-220 words in 3 brief paragraphs';
  } else if (length === 'detailed') {
    lengthDirective = 'detailed and comprehensive, approximately 450-500 words across 4 to 5 paragraphs';
  }

  let toneDirective =
    'Professional, articulate, confident, and genuine. Avoid overly cliché openings like "I am writing to enthusiastically apply...".';
  if (tone === 'technical') {
    toneDirective =
      'Technical and architecture-focused. Highlight hands-on implementation, systems design, developer ownership, and technical problem-solving.';
  } else if (tone === 'startup') {
    toneDirective =
      'High-energy, scrappy, and startup-aligned. Emphasize speed of execution, end-to-end product ownership, and customer impact.';
  }

  let prompt = `Please generate a tailored cover letter for:
TARGET ROLE: ${role}
TARGET COMPANY: ${company}

TARGET LENGTH: ${lengthDirective}
TONE & STYLE: ${toneDirective}

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 3500)}
"""`;

  if (customNote && customNote.trim()) {
    prompt += `\n\nCANDIDATE SPECIFIC FOCUS / NOTE:\n${customNote.trim()}`;
  }

  return prompt;
}
