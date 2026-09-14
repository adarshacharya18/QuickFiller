import React, { useState, useEffect } from 'react';
import { Cpu, Key, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, ShieldCheck, Briefcase } from 'lucide-react';
import { LLMSettings, LLMProvider } from '../../types/llm';

interface SettingsTabProps {
  settings: LLMSettings;
  onSaveSettings: (settings: LLMSettings) => void;
  jobTrackerEnabled?: boolean;
  autoTrackOnSubmit?: boolean;
  onToggleJobTracker?: (enabled: boolean) => void;
  onToggleAutoTrackOnSubmit?: (enabled: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSaveSettings,
  jobTrackerEnabled = true,
  autoTrackOnSubmit = true,
  onToggleJobTracker,
  onToggleAutoTrackOnSubmit,
}) => {
  const [formData, setFormData] = useState<LLMSettings>(settings);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchModels = (host: string) => {
    setLoadingModels(true);
    chrome.runtime.sendMessage({ type: 'CHECK_OLLAMA', host }, (res) => {
      setLoadingModels(false);
      if (res?.success && Array.isArray(res.models)) {
        setOllamaModels(res.models);
        if (res.models.length > 0 && !res.models.includes(formData.ollama.model)) {
          setFormData((prev) => ({
            ...prev,
            ollama: { ...prev.ollama, model: res.models[0] },
          }));
        }
      }
    });
  };

  useEffect(() => {
    fetchModels(formData.ollama.host);
  }, []);

  const testConnection = () => {
    setTestingConnection(true);
    setTestResult(null);
    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_ANSWER',
        questionPrompt: 'Say "Connection successful!" in 3 words.',
        customInstructions: 'Respond only with connection test confirmation.',
        llmSettings: formData,
      },
      (res) => {
        setTestingConnection(false);
        if (res?.success) {
          setTestResult({
            success: true,
            message: `Success! Response: "${res.answer}"`,
          });
        } else {
          setTestResult({
            success: false,
            message: `Error: ${res?.error || 'Could not connect to model'}`,
          });
        }
      }
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl pb-4">
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
            LLM Engine Configuration
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Use 100% private local AI (Ollama) or bring your own cloud API key.
          </p>
        </div>

        {/* Provider Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Active AI Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {[
              { id: 'ollama', title: 'Ollama', desc: 'Local & Private' },
              { id: 'gemini', title: 'Gemini', desc: 'Fast Google AI' },
              { id: 'openai', title: 'OpenAI', desc: 'GPT-4o Mini' },
              { id: 'anthropic', title: 'Anthropic', desc: 'Claude 3.5' },
            ].map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, provider: prov.id as LLMProvider }))}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition ${
                  formData.provider === prov.id
                    ? 'border-sky-600 bg-sky-50/60 ring-1 ring-sky-600'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">{prov.title}</span>
                  {formData.provider === prov.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-500 block mt-0.5 truncate">
                  {prov.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider Specific Configuration */}
        {formData.provider === 'ollama' && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ollama Host URL
                </label>
                <input
                  type="text"
                  value={formData.ollama.host}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      ollama: { ...p.ollama, host: e.target.value },
                    }))
                  }
                  placeholder="http://localhost:11434"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">Model Name</label>
                  <button
                    onClick={() => fetchModels(formData.ollama.host)}
                    className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {ollamaModels.length > 0 ? (
                  <select
                    value={formData.ollama.model}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ollama: { ...p.ollama, model: e.target.value },
                      }))
                    }
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                  >
                    {ollamaModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.ollama.model}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ollama: { ...p.ollama, model: e.target.value },
                      }))
                    }
                    placeholder="llama3.2:3b"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                  />
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
              <span>
                Runs locally via <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-[10px]">{formData.ollama.host || 'http://localhost:11434'}</code>. No data leaves your machine.
              </span>
            </div>
          </div>
        )}

        {formData.provider === 'gemini' && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.gemini.apiKey}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      gemini: { ...p.gemini, apiKey: e.target.value },
                    }))
                  }
                  placeholder="AIzaSy..."
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
              <select
                value={formData.gemini.model}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    gemini: { ...p.gemini, model: e.target.value },
                  }))
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Recommended)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning)</option>
              </select>
            </div>
          </div>
        )}

        {formData.provider === 'openai' && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">OpenAI API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.openai.apiKey}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      openai: { ...p.openai, apiKey: e.target.value },
                    }))
                  }
                  placeholder="sk-..."
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
              <select
                value={formData.openai.model}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    openai: { ...p.openai, model: e.target.value },
                  }))
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>
          </div>
        )}

        {formData.provider === 'anthropic' && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Anthropic API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.anthropic.apiKey}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      anthropic: { ...p.anthropic, apiKey: e.target.value },
                    }))
                  }
                  placeholder="sk-ant-..."
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
              <select
                value={formData.anthropic.model}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    anthropic: { ...p.anthropic, model: e.target.value },
                  }))
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
              >
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Fast)</option>
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Highest quality)</option>
              </select>
            </div>
          </div>
        )}

        {/* Test Connection */}
        <div className="pt-1 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <button
              type="button"
              disabled={testingConnection}
              onClick={testConnection}
              className="text-xs bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-50 text-slate-800 font-medium px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              {testingConnection && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {testingConnection ? 'Testing Connection...' : 'Test Connection'}
            </button>

            {testResult && (
              <div
                className={`flex items-center gap-1.5 text-xs animate-slide-down ${
                  testResult.success ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="truncate max-w-[300px]">{testResult.message}</span>
              </div>
            )}
          </div>

          {testResult && !testResult.success && testResult.message.includes('403') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 animate-slide-down">
              <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                Ollama 403 Forbidden Origin Fix
              </p>
              <div className="text-[11px] text-amber-800 space-y-1">
                <p>1. Reload QuickFiller in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">chrome://extensions</code> to refresh CORS headers.</p>
                <p>2. Or launch Ollama with origins allowed:</p>
                <pre className="bg-amber-100/70 p-2 rounded text-[10px] font-mono select-all overflow-x-auto">
OLLAMA_ORIGINS="*" ollama serve
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Save Bar */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 py-3 px-4 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 rounded-b-xl sm:rounded-b-2xl flex items-center justify-between z-20 shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium capitalize truncate max-w-[160px] sm:max-w-xs">
            Model: <strong className="text-slate-800">{formData.provider}</strong>
          </span>
          <button
            onClick={() => onSaveSettings(formData)}
            className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-medium text-xs px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>

      {/* Job Application Tracker Toggle Card */}
      {onToggleJobTracker && (
        <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Job Application Tracker
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-xl">
              Show a 1-click &quot;Track Job&quot; button in the QuickFiller drawer on job application pages. Applications and statuses are stored 100% locally on your machine.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={() => onToggleJobTracker(!jobTrackerEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden ${
                jobTrackerEnabled ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  jobTrackerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-800 w-16">
              {jobTrackerEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {/* Auto-track on Submit Sub-card */}
      {onToggleAutoTrackOnSubmit && jobTrackerEnabled && (
        <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 -mt-2">
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
              Auto-Track on Application Submission
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">
              Automatically logs the application when an ATS form submission or confirmation page (e.g. <em>/thank-you</em>, <em>/confirmation</em>) is detected. Displays a non-intrusive toast notification with an Undo option.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={() => onToggleAutoTrackOnSubmit(!autoTrackOnSubmit)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden ${
                autoTrackOnSubmit ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  autoTrackOnSubmit ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-800 w-16">
              {autoTrackOnSubmit ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {/* Site Access & Shortcut Privacy Guide */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            Site Access & Keyboard Shortcut
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            QuickFiller is designed with a privacy-first approach. You can restrict site access to run only when clicked.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Extension Site Access</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                On click
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              In <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[10px]">chrome://extensions</code>, set{' '}
              <em>"Allow this extension to read and change all your data on websites that you visit"</em> to <strong>"On click"</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Toggle Copilot Shortcut</span>
              <kbd className="text-[11px] bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono font-semibold">
                Alt+Shift+Q
              </kbd>
            </div>
            <p className="text-[11px] text-slate-600">
              Press <strong className="text-slate-800">Alt+Shift+Q</strong> on any web page to instantly launch or toggle the copilot drawer. Customize in <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[10px]">chrome://extensions/shortcuts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
