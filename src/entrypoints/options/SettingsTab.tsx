import React, { useState, useEffect } from 'react';
import { Cpu, Key, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { LLMSettings, LLMProvider } from '../../types/llm';

interface SettingsTabProps {
  settings: LLMSettings;
  onSaveSettings: (settings: LLMSettings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<LLMSettings>(settings);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
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
    setTestResult(null);
    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_ANSWER',
        questionPrompt: 'Say "Connection successful!" in 3 words.',
        customInstructions: 'Respond only with connection test confirmation.',
      },
      (res) => {
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
    <div className="space-y-8 max-w-4xl pb-16">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-600" />
            LLM Engine Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose between 100% private local AI (Ollama) or Bring-Your-Own-Key cloud APIs.
          </p>
        </div>

        {/* Provider Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Active AI Provider</label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { id: 'ollama', title: 'Ollama (Local)', desc: '100% Private, Free' },
              { id: 'gemini', title: 'Google Gemini', desc: 'Fast, High Quality' },
              { id: 'openai', title: 'OpenAI (GPT-4o)', desc: 'Standard cloud LLM' },
              { id: 'anthropic', title: 'Anthropic Claude', desc: 'Nuanced writing' },
            ].map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, provider: prov.id as LLMProvider }))}
                className={`p-3.5 rounded-xl border text-left transition ${
                  formData.provider === prov.id
                    ? 'border-sky-600 bg-sky-50/50 ring-1 ring-sky-600'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                <span className="block font-semibold text-xs text-slate-900">{prov.title}</span>
                <span className="text-[11px] text-slate-500">{prov.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider Specific Configuration */}
        {formData.provider === 'ollama' && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
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
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
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
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
                  />
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Ensure Ollama is running on your machine (e.g., <code>ollama run llama3.2:3b</code>).
            </p>
          </div>
        )}

        {formData.provider === 'gemini' && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
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
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none"
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
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Cost-Efficient)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning)</option>
              </select>
            </div>
          </div>
        )}

        {formData.provider === 'openai' && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
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
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none"
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
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>
          </div>
        )}

        {formData.provider === 'anthropic' && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
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
                  className="w-full text-xs p-2.5 pr-10 rounded-lg border border-slate-200 bg-white outline-none"
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
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none"
              >
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Fast)</option>
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Highest quality)</option>
              </select>
            </div>
          </div>
        )}

        {/* Test Connection */}
        <div className="pt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={testConnection}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-4 py-2 rounded-lg transition"
          >
            Test Connection
          </button>

          {testResult && (
            <div
              className={`flex items-center gap-2 text-xs ${
                testResult.success ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end max-w-5xl mx-auto z-50">
        <button
          onClick={() => onSaveSettings(formData)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
};
