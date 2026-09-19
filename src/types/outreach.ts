import { CandidateProfile } from './profile';
import { CustomPasteItem } from './storage';

export type OutreachPersona = 'recruiter' | 'technical';

export interface OutreachOptions {
  rawDraft: string;
  persona: OutreachPersona;
  contextNotes?: string;
  company?: string;
  role?: string;
  candidateProfile: CandidateProfile;
  pasteBank?: CustomPasteItem[];
}

export interface OutreachResult {
  connectionNote: string;
  connectionNoteCharCount: number;
  fullPitch: string;
  fullPitchWordCount: number;
  persona: OutreachPersona;
}
