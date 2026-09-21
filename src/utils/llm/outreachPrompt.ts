import { CandidateProfile } from '../../types/profile';
import { CustomPasteItem } from '../../types/storage';
import { OutreachPersona, OutreachOptions, OutreachResult } from '../../types/outreach';

export const DELIMITER_VARIANT_A = '=== VARIANT A: CONNECTION NOTE ===';
export const DELIMITER_VARIANT_B = '=== VARIANT B: HIGH-IMPACT PITCH ===';

/**
 * Builds the system prompt for refining raw outreach drafts into high-impact messages.
 */
export function buildOutreachSystemPrompt(
  profile: CandidateProfile,
  persona: OutreachPersona,
  customPasteBank: CustomPasteItem[] = []
): string {
  const candidateName = `${profile.personal.firstName} ${profile.personal.lastName}`.trim() || 'Candidate';
  const skillsList = profile.skills.join(', ') || 'Software Engineering, Problem Solving';

  const projectsList = (profile.portfolioDetails.featuredProjects || [])
    .filter((p) => p.title && (p.description || p.url))
    .map(
      (p) =>
        `- ${p.title}: ${p.description || 'Project'}${
          p.technologies?.length ? ` (Tech Stack: ${p.technologies.join(', ')})` : ''
        }${p.url ? ` [Link: ${p.url}]` : ''}`
    )
    .join('\n');

  const experienceList = (profile.experience || [])
    .filter((e) => e.company || e.role)
    .map(
      (e) =>
        `- ${e.role} at ${e.company}${e.location ? ` in ${e.location}` : ''} (${e.startDate || 'N/A'} - ${e.endDate || 'Present'}):\n  ${(
          e.highlights || []
        )
          .map((h) => `• ${h}`)
          .join('\n  ')}`
    )
    .join('\n');

  const pasteBankSnippets = (customPasteBank || [])
    .filter((item) => item.label && item.value)
    .map((item) => `- ${item.label}: "${item.value}"`)
    .join('\n');

  const personaGuidance =
    persona === 'recruiter'
      ? `TARGET AUDIENCE: Recruiter / Talent Partner / HR
- Focus: Highlight core skills, relevant domain match, verified accomplishments, timeline/availability, and a low-friction invitation to connect.
- Style: Crisp, energetic, highly professional, easy to skim on mobile.`
      : `TARGET AUDIENCE: Engineering Lead / Hiring Manager / Technical Peer
- Focus: Speak as an engineer to an engineer. Focus on tech stack nuances, system architecture, shared engineering challenges, open-source work, or specific technical problems.
- Style: Direct, intellectually authentic, collaborative, and substantive. Avoid HR fluff or generic buzzwords.`;

  return `You are QuickFiller Outreach Studio Copilot, an elite career communication strategist and technical copywriter.
Your mission is to take a candidate's rough, informal notes or draft and refine it into TWO distinct, compelling, high-converting outreach messages.

CANDIDATE PROFILE (GROUND TRUTH):
- Name: ${candidateName}
- Email: ${profile.personal.email || 'N/A'}
- Current Location: ${profile.personal.city || ''}${profile.personal.state ? `, ${profile.personal.state}` : ''}
- Core Skills: ${skillsList}
- Portfolio: ${profile.personal.portfolioUrl || profile.portfolioDetails.url || 'N/A'}
- GitHub: ${profile.personal.githubUrl || 'N/A'}
- LinkedIn: ${profile.personal.linkedinUrl || 'N/A'}

RELEVANT EXPERIENCE:
${experienceList || 'None listed'}

FEATURED PROJECTS:
${projectsList || 'None listed'}

CUSTOM SNIPPETS:
${pasteBankSnippets || 'None listed'}

${personaGuidance}

STRICT ANTI-CLICHÉ & AUTHENTICITY RULES:
1. NEVER start with or include generic AI clichés:
   - FORBIDDEN: "I hope this message finds you well"
   - FORBIDDEN: "I hope you are having a wonderful week"
   - FORBIDDEN: "I was thrilled/captivated to come across your profile"
   - FORBIDDEN: "I am writing to express my eager interest in"
   - FORBIDDEN: "synergy", "esteemed organization", "passionate go-getter", "rockstar"
2. Start immediately with high-signal context (e.g. mutual interest, a specific project, an insightful observation, or a shared tech stack).
3. ANTI-HALLUCINATION: ONLY reference skills, past companies, and projects that appear in the candidate's profile. Never invent employers or false metrics.
4. Keep the tone authentic, conversational, confident, and polite without being subservient.

OUTPUT REQUIREMENTS:
You MUST provide exactly two variations using the following delimiters:

${DELIMITER_VARIANT_A}
(A short, punchy note strictly under 300 characters total. Ideal for a LinkedIn connection invitation or quick Twitter/X DM. Must include a warm, concise sign-off.)

${DELIMITER_VARIANT_B}
(A high-impact pitch of 2-3 concise paragraphs. Ideal for InMail, Email, or detailed direct message. Includes a compelling hook, 1-2 verified candidate achievements, and a low-pressure call-to-action asking for a brief 10-minute exchange.)

Do not include preambles, intros, or outtros. Output ONLY the two delimited sections.`;
}

/**
 * Builds the user prompt containing raw user input and contextual targeting details.
 */
export function buildOutreachUserPrompt(options: OutreachOptions): string {
  const parts: string[] = [];

  parts.push(`RAW DRAFT / THOUGHTS:\n"${options.rawDraft.trim()}"`);

  if (options.company && options.company.trim()) {
    parts.push(`Target Company: ${options.company.trim()}`);
  }

  if (options.role && options.role.trim()) {
    parts.push(`Target Role: ${options.role.trim()}`);
  }

  if (options.contextNotes && options.contextNotes.trim()) {
    parts.push(`Additional Context: ${options.contextNotes.trim()}`);
  }

  parts.push(
    `Please refine this draft for the ${
      options.persona === 'recruiter' ? 'Recruiter' : 'Technical / Engineering'
    } audience following the strict 2-variant output format.`
  );

  return parts.join('\n\n');
}

/**
 * Parses raw LLM response into connection note and full pitch variants.
 */
export function parseOutreachResponse(rawOutput: string, persona: OutreachPersona): OutreachResult {
  let cleaned = (rawOutput || '').trim();

  // Strip wrapping markdown code fences if present (```text ... ``` or ```markdown ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Attempt JSON parsing in case LLM responded with structured JSON
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      const connectionNote = (parsed.connectionNote || parsed.variantA || parsed.note || '').trim();
      const fullPitch = (parsed.fullPitch || parsed.variantB || parsed.pitch || '').trim();

      if (connectionNote || fullPitch) {
        return {
          connectionNote,
          connectionNoteCharCount: connectionNote.length,
          fullPitch,
          fullPitchWordCount: fullPitch.split(/\s+/).filter(Boolean).length,
          persona,
        };
      }
    } catch {
      // Fall through to regex delimiter extraction
    }
  }

  let connectionNote = '';
  let fullPitch = '';

  const delimAIndex = cleaned.search(/===\s*VARIANT\s*A[^=]*===/i);
  const delimBIndex = cleaned.search(/===\s*VARIANT\s*B[^=]*===/i);

  if (delimAIndex !== -1 && delimBIndex !== -1 && delimBIndex > delimAIndex) {
    const afterA = cleaned.slice(delimAIndex);
    const splitA = afterA.split(/===\s*VARIANT\s*B[^=]*===/i);

    const partA = splitA[0].replace(/===\s*VARIANT\s*A[^=]*===/i, '').trim();
    const partB = (splitA[1] || '').trim();

    connectionNote = partA;
    fullPitch = partB;
  } else if (delimAIndex !== -1) {
    connectionNote = cleaned.slice(delimAIndex).replace(/===\s*VARIANT\s*A[^=]*===/i, '').trim();
    fullPitch = connectionNote;
  } else if (delimBIndex !== -1) {
    fullPitch = cleaned.slice(delimBIndex).replace(/===\s*VARIANT\s*B[^=]*===/i, '').trim();
    connectionNote = fullPitch.slice(0, 280).trim();
  } else {
    // Delimiters missing: fallback cleanly
    const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      connectionNote = paragraphs[0];
      fullPitch = cleaned;
    } else {
      connectionNote = cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
      fullPitch = cleaned;
    }
  }

  // Strip any remaining conversational boilerplate like "Here are the refined messages:"
  connectionNote = connectionNote.replace(/^(here\s+(are|is)\s+.*?:|refined\s+message:?)\s*/i, '').trim();
  fullPitch = fullPitch.replace(/^(here\s+(are|is)\s+.*?:|refined\s+message:?)\s*/i, '').trim();

  return {
    connectionNote,
    connectionNoteCharCount: connectionNote.length,
    fullPitch,
    fullPitchWordCount: fullPitch.split(/\s+/).filter(Boolean).length,
    persona,
  };
}
