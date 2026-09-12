import React, { useState, useEffect } from 'react';
import { User, HelpCircle, Cpu, Zap, Check } from 'lucide-react';
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
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl">
              <Zap className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                QuickFiller
                <span className="text-[10px] font-medium bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/30">
                  Open Source
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Local-First Job Application Copilot & Autofiller
              </p>
            </div>
          </div>

          {savedBanner && (
            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Changes saved locally</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-200 mb-8">
          {[
            { id: 'profile', label: 'Candidate Profile & Resume', icon: User },
            { id: 'questions', label: 'Screening Q&A Bank', icon: HelpCircle },
            { id: 'settings', label: 'AI / LLM Configuration', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3.5 px-4 text-xs font-semibold border-b-2 transition ${
                  isActive
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                {tab.label}
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
