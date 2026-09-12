export type QuestionCategory = 
  | 'work_auth'
  | 'visa'
  | 'notice_period'
  | 'salary'
  | 'relocation'
  | 'eeo'
  | 'custom'
  | 'behavioral';

export interface ScreeningQuestion {
  id: string;
  category: QuestionCategory;
  questionPrompt: string; // e.g., "Are you legally authorized to work?"
  answer: string;
  tags: string[];
  updatedAt: number;
}

export interface ScreeningWizardAnswers {
  authorizedToWork: string; // "Yes", "No"
  requireSponsorship: string; // "No", "Yes"
  noticePeriod: string; // e.g. "Immediate", "2 weeks", "30 days"
  desiredSalary: string; // e.g. "$120,000 - $150,000 USD"
  openToRelocation: string; // "Yes", "Remote Only", "No"
  gender?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
}

export const defaultWizardAnswers: ScreeningWizardAnswers = {
  authorizedToWork: 'Yes',
  requireSponsorship: 'No',
  noticePeriod: 'Immediate',
  desiredSalary: 'Market Rate / Negotiable',
  openToRelocation: 'Remote Only',
  gender: 'Prefer not to say',
  veteranStatus: 'Not a veteran',
  disabilityStatus: 'No',
};
