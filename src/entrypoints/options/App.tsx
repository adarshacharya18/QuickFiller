import React, { useState, useEffect } from 'react';
import { User, HelpCircle, Cpu, Zap, Check, Maximize2 } from 'lucide-react';
import { getStorageData, updateStorageData } from '../../utils/storage';
import { StorageData, defaultStorageData } from '../../types/storage';
import { CandidateProfile } from '../../types/profile';
import { ScreeningWizardAnswers, ScreeningQuestion } from '../../types/questions';
import { LLMSettings } from '../../types/llm';
import { ProfileTab } from './ProfileTab';
import { QuestionsTab } from './QuestionsTab';
import { SettingsTab } from './SettingsTab';

export const App: React.FC = () => {
  const [data, setData] = useState<StorageData>(defaultStorageData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'questions' | 'settings'>('profile');
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
    questionBank: ScreeningQuestion[]
  ) => {
    await updateStorageData({ wizardAnswers, questionBank });
    setData((prev) => ({ ...prev, wizardAnswers, questionBank }));
    triggerSaveNotification();
  };

  const handleSaveSettings = async (llmSettings: LLMSettings) => {
    await updateStorageData({ llmSettings });
    setData((prev) => ({ ...prev, llmSettings }));
    triggerSaveNotification();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-13 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500/15 border border-sky-500/30 rounded-lg text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  QuickFiller
                </span>
                <span className="text-[9px] font-semibold bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded border border-sky-500/30">
                  v0.1
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Local-First Job Copilot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedBanner && (
              <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-[11px] px-2.5 py-1 rounded-md border border-emerald-500/30 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Saved locally</span>
                <span className="sm:hidden">Saved</span>
              </div>
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
            onSaveQuestions={handleSaveQuestions}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab settings={data.llmSettings} onSaveSettings={handleSaveSettings} />
        )}
      </main>
    </div>
  );
};
