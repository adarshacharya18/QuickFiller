import React, { useState, useEffect } from 'react';
import { User, HelpCircle, Cpu, Zap, Check, Maximize2, Briefcase } from 'lucide-react';
import { getStorageData, updateStorageData } from '../../utils/storage';
import { StorageData, defaultStorageData, CustomPasteItem } from '../../types/storage';
import { CandidateProfile } from '../../types/profile';
import { ScreeningWizardAnswers, ScreeningQuestion } from '../../types/questions';
import { LLMSettings } from '../../types/llm';
import { JobApplication } from '../../types/applications';
import { ProfileTab } from './ProfileTab';
import { QuestionsTab } from './QuestionsTab';
import { SettingsTab } from './SettingsTab';
import { ApplicationsTab } from './ApplicationsTab';

export const App: React.FC = () => {
  const [data, setData] = useState<StorageData>(defaultStorageData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'questions' | 'applications' | 'settings'>('profile');
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    getStorageData().then((storage) => {
      setData(storage);
      setLoading(false);
    });
  }, []);

  const triggerSaveNotification = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const openInFullTab = () => {
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    } else {
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    }
  };

  const handleSaveProfile = async (profile: CandidateProfile) => {
    await updateStorageData({ profile });
    setData((prev) => ({ ...prev, profile }));
    triggerSaveNotification();
  };

  const handleSaveQuestions = async (
    wizardAnswers: ScreeningWizardAnswers,
    questionBank: ScreeningQuestion[],
    customPasteBank?: CustomPasteItem[]
  ) => {
    const updatedPasteBank = customPasteBank ?? data.customPasteBank ?? [];
    await updateStorageData({ wizardAnswers, questionBank, customPasteBank: updatedPasteBank });
    setData((prev) => ({ ...prev, wizardAnswers, questionBank, customPasteBank: updatedPasteBank }));
    triggerSaveNotification();
  };

  const handleSaveApplications = async (applications: JobApplication[]) => {
    await updateStorageData({ applications });
    setData((prev) => ({ ...prev, applications }));
    triggerSaveNotification();
  };

  const handleToggleJobTracker = async (jobTrackerEnabled: boolean) => {
    await updateStorageData({ jobTrackerEnabled });
    setData((prev) => ({ ...prev, jobTrackerEnabled }));
    triggerSaveNotification();
  };

  const handleSaveSettings = async (llmSettings: LLMSettings) => {
    await updateStorageData({ llmSettings });
    setData((prev) => ({ ...prev, llmSettings }));
    triggerSaveNotification();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
          <Zap className="w-4 h-4 animate-spin text-sky-600" />
          <span>Loading preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-sky-500/20 border border-sky-400/30 rounded-lg">
              <Zap className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight">QuickFiller Copilot</h1>
              <p className="text-[10px] text-slate-400">Settings &amp; Candidate Profile</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedBanner && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md animate-in fade-in duration-200">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            <button
              onClick={openInFullTab}
              title="Open settings in a new browser tab"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-3.5 sm:py-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-4 sm:mb-6">
          {[
            { id: 'profile', short: 'Profile', label: 'Candidate Profile', icon: User },
            { id: 'questions', short: 'Q&A Bank', label: 'Screening Q&A', icon: HelpCircle },
            { id: 'applications', short: 'Tracker', label: 'Job Tracker', icon: Briefcase },
            { id: 'settings', short: 'AI Models', label: 'AI Settings', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 sm:pb-3 px-1 sm:px-4 text-xs font-semibold border-b-2 transition ${
                  isActive
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'profile' && (
          <ProfileTab profile={data.profile} onSaveProfile={handleSaveProfile} />
        )}

        {activeTab === 'questions' && (
          <QuestionsTab
            wizardAnswers={data.wizardAnswers}
            questionBank={data.questionBank}
            customPasteBank={data.customPasteBank}
            onSaveQuestions={handleSaveQuestions}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsTab
            applications={data.applications || []}
            jobTrackerEnabled={data.jobTrackerEnabled ?? true}
            onSaveApplications={handleSaveApplications}
            onToggleJobTracker={handleToggleJobTracker}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={data.llmSettings}
            onSaveSettings={handleSaveSettings}
            jobTrackerEnabled={data.jobTrackerEnabled ?? true}
            onToggleJobTracker={handleToggleJobTracker}
          />
        )}
      </main>
    </div>
  );
};
