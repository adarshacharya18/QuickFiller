import React, { useState, useEffect } from 'react';
import { Zap, Settings, ExternalLink, Check, User, Cpu, ShieldCheck } from 'lucide-react';
import { getStorageData, updateStorageData } from '../../utils/storage';
import { StorageData } from '../../types/storage';

export const App: React.FC = () => {
  const [data, setData] = useState<StorageData | null>(null);

  useEffect(() => {
    getStorageData().then(setData);
  }, []);

  const toggleEnabled = async () => {
    if (!data) return;
    const newEnabled = !data.extensionEnabled;
    await updateStorageData({ extensionEnabled: newEnabled });
    setData((prev) => (prev ? { ...prev, extensionEnabled: newEnabled } : null));
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!data) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        Loading QuickFiller...
      </div>
    );
  }

  const profileComplete = Boolean(
    data.profile.personal.firstName && data.profile.personal.email
  );

  return (
    <div className="p-4 bg-white text-slate-800 text-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/30 rounded-lg">
            <Zap className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">QuickFiller</h1>
            <p className="text-[10px] text-slate-400">Local Job Application Copilot</p>
          </div>
        </div>

        <button
          onClick={toggleEnabled}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
            data.extensionEnabled
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          {data.extensionEnabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Profile Status */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-500" />
            Candidate Profile
          </span>
          {profileComplete ? (
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="text-[10px] text-amber-600 font-medium">Incomplete</span>
          )}
        </div>

        {profileComplete ? (
          <div className="text-[11px] text-slate-600">
            <p className="font-medium text-slate-800">
              {data.profile.personal.firstName} {data.profile.personal.lastName}
            </p>
            <p className="truncate text-slate-500">{data.profile.personal.email}</p>
            {data.profile.personal.portfolioUrl && (
              <p className="truncate text-sky-600 mt-0.5">{data.profile.personal.portfolioUrl}</p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Upload your resume or set your profile in Options to start autofilling.
          </p>
        )}
      </div>

      {/* Active LLM */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
        <span className="text-slate-600 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-sky-600" />
          Active Model:
        </span>
        <span className="font-semibold text-slate-800">
          {data.llmSettings.provider === 'ollama'
            ? `Ollama (${data.llmSettings.ollama.model || 'llama3.2:3b'})`
            : data.llmSettings.provider}
        </span>
      </div>

      {/* Open Options Button */}
      <button
        onClick={openOptions}
        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-xl transition shadow-sm"
      >
        <Settings className="w-3.5 h-3.5" />
        Open Profile & Settings
      </button>
    </div>
  );
};
