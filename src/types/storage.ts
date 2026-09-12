import { CandidateProfile, defaultProfile } from './profile';
import { ScreeningQuestion, ScreeningWizardAnswers, defaultWizardAnswers } from './questions';
import { LLMSettings, defaultLLMSettings } from './llm';

export interface StorageData {
  profile: CandidateProfile;
  wizardAnswers: ScreeningWizardAnswers;
  questionBank: ScreeningQuestion[];
  llmSettings: LLMSettings;
  extensionEnabled: boolean;
}

export const defaultStorageData: StorageData = {
  profile: defaultProfile,
  wizardAnswers: defaultWizardAnswers,
  questionBank: [],
  llmSettings: defaultLLMSettings,
  extensionEnabled: true,
};
