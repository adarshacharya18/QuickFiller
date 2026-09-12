export type QuestionCategory = 
  | 'custom'
  | 'behavioral'
  | 'technical'
  | 'compensation'
  | 'company_specific'
  | 'culture_fit'
  | 'work_auth'
  | 'visa'
  | 'notice_period'
  | 'salary'
  | 'relocation'
  | 'eeo';

export interface ScreeningQuestion {
  id: string;
  category: QuestionCategory;
  questionPrompt: string; // e.g., "Describe a challenging technical project"
  answer: string;
  tags: string[];
  isPinned?: boolean;
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
