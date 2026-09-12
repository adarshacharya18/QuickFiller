import { CandidateProfile } from '../../types/profile';
import { ScreeningWizardAnswers, ScreeningQuestion } from '../../types/questions';

export function buildSystemPrompt(
  profile: CandidateProfile,
  wizardAnswers: ScreeningWizardAnswers,
  questionBank: ScreeningQuestion[],
  jobContext?: { title?: string; company?: string; descriptionSnippet?: string }
): string {
  const projectsList = profile.portfolioDetails.featuredProjects
    .map((p) => `- ${p.title}: ${p.description} (Tech: ${p.technologies.join(', ')})${p.url ? ` [Demo: ${p.url}]` : ''}`)
    .join('\n');

  const experienceList = profile.experience
    .map((e) => `- ${e.role} at ${e.company} (${e.startDate} - ${e.endDate}):\n  ${e.highlights.map((h) => `• ${h}`).join('\n  ')}`)
    .join('\n');

  const educationList = profile.education
    .map((ed) => `- ${ed.degree} in ${ed.fieldOfStudy || 'N/A'}, ${ed.institution} (${ed.graduationYear})`)
    .join('\n');

  const knownAnswers = questionBank
    .map((q) => `Q: ${q.questionPrompt}\nA: ${q.answer}`)
    .join('\n\n');

  return `You are QuickFiller, an AI assistant helping a job candidate apply for roles.
Your task is to draft authentic, concise, high-impact answers to job application screening questions.

CANDIDATE INFORMATION:
- Name: ${profile.personal.firstName} ${profile.personal.lastName}
- Contact: ${profile.personal.email} | ${profile.personal.phone} | Location: ${profile.personal.city}
- Portfolio: ${profile.personal.portfolioUrl || 'N/A'}
- GitHub: ${profile.personal.githubUrl || 'N/A'}
- LinkedIn: ${profile.personal.linkedinUrl || 'N/A'}

STANDARD WORK ELIGIBILITY & PREFERENCES:
- Legally authorized to work: ${wizardAnswers.authorizedToWork}
- Requires visa sponsorship: ${wizardAnswers.requireSponsorship}
- Notice Period / Start Date: ${wizardAnswers.noticePeriod}
- Desired Salary / Compensation: ${wizardAnswers.desiredSalary}
- Open to Relocation: ${wizardAnswers.openToRelocation}

KEY SKILLS:
${profile.skills.join(', ') || 'N/A'}

FEATURED PORTFOLIO PROJECTS:
${projectsList || 'None specified'}

WORK EXPERIENCE:
${experienceList || 'None specified'}

EDUCATION:
${educationList || 'None specified'}

PREVIOUS APPROVED ANSWERS:
${knownAnswers || 'None specified'}

${jobContext?.company ? `TARGET COMPANY: ${jobContext.company}` : ''}
${jobContext?.title ? `TARGET ROLE: ${jobContext.title}` : ''}
${jobContext?.descriptionSnippet ? `JOB DESCRIPTION EXCERPT:\n${jobContext.descriptionSnippet}` : ''}

INSTRUCTIONS:
1. Always write from the first-person perspective ("I am...", "In my previous experience, I...").
2. Be direct, authentic, professional, and confident. Avoid generic AI fluff.
3. If the question asks for factual data (e.g. salary, notice period, sponsorship), answer using the candidate's exact preferences.
4. If the question asks about a project or technical challenge, reference one of the candidate's actual projects or work experiences and mention the portfolio/github link if relevant.
5. Keep answers to the point (1-3 paragraphs or concise sentences as appropriate for the question).
6. Output ONLY the drafted answer text. Do not include conversational filler like "Here is a response:".`;
}
