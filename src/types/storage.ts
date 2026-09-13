import { CandidateProfile, defaultProfile } from './profile';
import { ScreeningQuestion, ScreeningWizardAnswers, defaultWizardAnswers } from './questions';
import { LLMSettings, defaultLLMSettings } from './llm';
import { JobApplication } from './applications';

export interface CustomPasteItem {
  id: string;
  label: string;
  value: string;
}

export interface StorageData {
  profile: CandidateProfile;
  wizardAnswers: ScreeningWizardAnswers;
  questionBank: ScreeningQuestion[];
  customPasteBank: CustomPasteItem[];
  llmSettings: LLMSettings;
  applications: JobApplication[];
  jobTrackerEnabled: boolean;
  autoTrackOnSubmit: boolean;
  extensionEnabled: boolean;
}

export const defaultStorageData: StorageData = {
  profile: defaultProfile,
  wizardAnswers: defaultWizardAnswers,
  questionBank: [],
  customPasteBank: [],
  llmSettings: defaultLLMSettings,
  applications: [],
  jobTrackerEnabled: true,
  autoTrackOnSubmit: true,
  extensionEnabled: true,
};
