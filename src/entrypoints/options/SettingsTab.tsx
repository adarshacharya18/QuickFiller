import React, { useState, useEffect } from 'react';
import { Cpu, Key, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, ShieldCheck, Briefcase } from 'lucide-react';
import { LLMSettings, LLMProvider } from '../../types/llm';
import { CURATED_MODELS } from '../../utils/llm/discovery';

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
  const [discoveredModels, setDiscoveredModels] = useState<Record<LLMProvider, string[]>>({
    ollama: [],
    gemini: [],
    openai: [],
    anthropic: [],
  });
  const [loadingProviderModels, setLoadingProviderModels] = useState<Record<LLMProvider, boolean>>({
    ollama: false,
    gemini: false,
    openai: false,
    anthropic: false,
  });
  const [modelFetchError, setModelFetchError] = useState<Record<LLMProvider, string | null>>({
    ollama: null,
    gemini: null,
    openai: null,
    anthropic: null,
  });
  const [addingCustomModel, setAddingCustomModel] = useState<Record<LLMProvider, boolean>>({
    ollama: false,
    gemini: false,
    openai: false,
    anthropic: false,
  });
  const [customInputText, setCustomInputText] = useState<Record<LLMProvider, string>>({
    ollama: '',
    gemini: '',
    openai: '',
    anthropic: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const getProviderModel = (prov: LLMProvider): string => {
    return formData[prov]?.model || '';
  };

  const setProviderModel = (prov: LLMProvider, modelVal: string) => {
    setFormData((prev) => ({
      ...prev,
      [prov]: { ...prev[prov], model: modelVal },
    }));
  };

  const handleAddCustomModel = (provider: LLMProvider, inputName: string) => {
    const trimmed = inputName.trim();
    if (!trimmed) return;

    const currentCustom = formData.customModels?.[provider] || [];
    const updatedCustomList = Array.from(new Set([...currentCustom, trimmed]));

    const updatedSettings: LLMSettings = {
      ...formData,
      [provider]: {
        ...formData[provider],
        model: trimmed,
      },
      customModels: {
        ollama: formData.customModels?.ollama || [],
        gemini: formData.customModels?.gemini || [],
        openai: formData.customModels?.openai || [],
        anthropic: formData.customModels?.anthropic || [],
        [provider]: updatedCustomList,
      },
    };

    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);

    setAddingCustomModel((prev) => ({ ...prev, [provider]: false }));
    setCustomInputText((prev) => ({ ...prev, [provider]: '' }));
  };

  const handleRemoveCustomModel = (provider: LLMProvider, modelToRemove: string) => {
    const currentCustom = formData.customModels?.[provider] || [];
    const updatedCustomList = currentCustom.filter((m) => m !== modelToRemove);

    let nextModel = getProviderModel(provider);
    if (nextModel === modelToRemove) {
      const curated = CURATED_MODELS[provider] || [];
      const discovered = discoveredModels[provider] || [];
      nextModel = updatedCustomList[0] || discovered[0] || curated[0]?.id || '';
    }

    const updatedSettings: LLMSettings = {
      ...formData,
      [provider]: {
        ...formData[provider],
        model: nextModel,
      },
      customModels: {
        ollama: formData.customModels?.ollama || [],
        gemini: formData.customModels?.gemini || [],
        openai: formData.customModels?.openai || [],
        anthropic: formData.customModels?.anthropic || [],
        [provider]: updatedCustomList,
      },
    };

    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);
  };

  const fetchModelsForProvider = (provider: LLMProvider) => {
    setLoadingProviderModels((prev) => ({ ...prev, [provider]: true }));
    setModelFetchError((prev) => ({ ...prev, [provider]: null }));

    const host = provider === 'ollama' ? formData.ollama.host : undefined;
    const apiKey =
      provider === 'gemini'
        ? formData.gemini.apiKey
        : provider === 'openai'
        ? formData.openai.apiKey
        : provider === 'anthropic'
        ? formData.anthropic.apiKey
        : undefined;

    chrome.runtime.sendMessage(
      {
        type: 'FETCH_PROVIDER_MODELS',
        provider,
        host,
        apiKey,
      },
      (res) => {
        setLoadingProviderModels((prev) => ({ ...prev, [provider]: false }));
        if (res?.success && Array.isArray(res.models)) {
          setDiscoveredModels((prev) => ({ ...prev, [provider]: res.models }));
          if (!getProviderModel(provider) && res.models.length > 0) {
            setProviderModel(provider, res.models[0]);
          }
        } else if (res?.error) {
          setModelFetchError((prev) => ({ ...prev, [provider]: res.error }));
        }
      }
    );
  };

  useEffect(() => {
    fetchModelsForProvider('ollama');
  }, []);

  const testConnection = () => {
    setTestingConnection(true);
    setTestResult(null);

    const handleConnectionSuccess = () => {
      setTestingConnection(false);
      const activeProv = formData.provider;
      const activeModel = getProviderModel(activeProv);
      const curatedIds = new Set((CURATED_MODELS[activeProv] || []).map((m) => m.id));
      const discovered = discoveredModels[activeProv] || [];
      const currentCustom = formData.customModels?.[activeProv] || [];

      // If the verified working model is custom, permanently add it to customModels
      let updatedSettings = formData;
      if (
        activeModel &&
        !curatedIds.has(activeModel) &&
        !discovered.includes(activeModel) &&
        !currentCustom.includes(activeModel)
      ) {
        updatedSettings = {
          ...formData,
          customModels: {
            ollama: formData.customModels?.ollama || [],
            gemini: formData.customModels?.gemini || [],
            openai: formData.customModels?.openai || [],
            anthropic: formData.customModels?.anthropic || [],
            [activeProv]: [...currentCustom, activeModel],
          },
        };
        setFormData(updatedSettings);
      }

      // Permanently save settings so reload preserves tested connection & model
      onSaveSettings(updatedSettings);

      setTestResult({
        success: true,
        message: `Success! Connected to ${activeModel}. Settings saved permanently.`,
      });
    };

    const handleConnectionFailure = (errorMsg?: string) => {
      setTestingConnection(false);
      const runtimeError = chrome.runtime?.lastError?.message;
      setTestResult({
        success: false,
        message: `Error: ${errorMsg || runtimeError || 'Could not connect to model'}`,
      });
    };

    try {
      chrome.runtime.sendMessage(
        {
          type: 'TEST_CONNECTION',
          llmSettings: formData,
        },
        (res) => {
          if (res !== undefined) {
            if (res.success) {
              handleConnectionSuccess();
            } else {
              handleConnectionFailure(res.error);
            }
          } else {
            // Port closed or TEST_CONNECTION not recognized by an older active background worker
            // Seamlessly fall back to GENERATE_ANSWER
            console.warn('[QuickFiller] TEST_CONNECTION returned undefined, falling back to GENERATE_ANSWER');
            chrome.runtime.sendMessage(
              {
                type: 'GENERATE_ANSWER',
                questionPrompt: 'Say "Connection successful!" in 3 words.',
                customInstructions: 'Respond only with connection test confirmation.',
                llmSettings: formData,
              },
              (fallbackRes) => {
                if (fallbackRes?.success) {
                  handleConnectionSuccess();
                } else {
                  handleConnectionFailure(fallbackRes?.error);
                }
              }
            );
          }
        }
      );
    } catch (e: any) {
      handleConnectionFailure(e?.message);
    }
  };

  const renderModelSelector = (provider: LLMProvider) => {
    const currentModel = getProviderModel(provider);
    const curated = CURATED_MODELS[provider] || [];
    const discovered = discoveredModels[provider] || [];
    const isLoading = loadingProviderModels[provider];
    const fetchErr = modelFetchError[provider];
    const isAdding = addingCustomModel[provider];

    const curatedIds = new Set(curated.map((m) => m.id));
    const savedCustomModels = Array.from(
      new Set([
        ...(formData.customModels?.[provider] || []),
        // If currentModel is neither curated nor discovered, treat as custom model
        ...(currentModel && !curatedIds.has(currentModel) && !discovered.includes(currentModel)
          ? [currentModel]
          : []),
      ])
    );

    const extraDiscovered = discovered.filter(
      (id) => !curatedIds.has(id) && !savedCustomModels.includes(id)
    );

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <label className="block text-xs font-medium text-slate-700">Model Name</label>
            {discovered.length > 0 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                Live ({discovered.length})
              </span>
            )}
            {savedCustomModels.length > 0 && (
              <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-medium">
                Custom ({savedCustomModels.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setAddingCustomModel((prev) => ({
                  ...prev,
                  [provider]: !prev[provider],
                }))
              }
              className="text-[11px] text-sky-600 hover:text-sky-700 font-medium transition cursor-pointer"
            >
              {isAdding ? 'Close' : '+ Add custom model'}
            </button>
            <button
              type="button"
              onClick={() => fetchModelsForProvider(provider)}
              disabled={isLoading}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-50 transition cursor-pointer"
              title="Fetch available models from API"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isAdding ? (
          <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-lg space-y-2 animate-slide-down">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-950">Add Permanent Custom Model</span>
              <button
                type="button"
                onClick={() => setAddingCustomModel((prev) => ({ ...prev, [provider]: false }))}
                className="text-[10px] text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInputText[provider] || ''}
                onChange={(e) =>
                  setCustomInputText((prev) => ({ ...prev, [provider]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomModel(provider, customInputText[provider] || '');
                  }
                }}
                placeholder={
                  provider === 'gemini'
                    ? 'e.g. gemini-2.5-flash'
                    : provider === 'openai'
                    ? 'e.g. o3-mini or ft:gpt-4o:...'
                    : provider === 'anthropic'
                    ? 'e.g. claude-3-7-sonnet-20250219'
                    : 'e.g. deepseek-r1:14b or custom-llama:latest'
                }
                className="w-full text-xs font-mono p-2 rounded-md border border-slate-300 bg-white outline-none focus:border-sky-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleAddCustomModel(provider, customInputText[provider] || '')}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-medium whitespace-nowrap transition active:scale-95 cursor-pointer"
              >
                Add &amp; Save
              </button>
            </div>
            <p className="text-[10px] text-sky-700">
              Permanently saved to storage and available across reloads and browser sessions.
            </p>
          </div>
        ) : (
          <select
            value={currentModel}
            onChange={(e) => {
              if (e.target.value === '__add_custom__') {
                setAddingCustomModel((prev) => ({ ...prev, [provider]: true }));
              } else {
                setProviderModel(provider, e.target.value);
              }
            }}
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
          >
            <optgroup label="Curated Latest Models">
              {curated.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.description ? `— ${m.description}` : ''}
                </option>
              ))}
            </optgroup>

            {savedCustomModels.length > 0 && (
              <optgroup label="My Custom Models (Permanent)">
                {savedCustomModels.map((m) => (
                  <option key={m} value={m}>
                    {m} (Custom)
                  </option>
                ))}
              </optgroup>
            )}

            {extraDiscovered.length > 0 && (
              <optgroup label={provider === 'ollama' ? 'Local Ollama Library' : 'Discovered from Account API'}>
                {extraDiscovered.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </optgroup>
            )}

            <optgroup label="Custom Models">
              <option value="__add_custom__">+ Add permanent custom model...</option>
            </optgroup>
          </select>
        )}

        {/* Saved Custom Models quick-select and delete chips */}
        {savedCustomModels.length > 0 && !isAdding && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Custom models:</span>
            {savedCustomModels.map((m) => (
              <span
                key={m}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-mono transition ${
                  currentModel === m
                    ? 'bg-sky-50 border-sky-300 text-sky-800 font-semibold'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setProviderModel(provider, m)}
                  className="hover:underline text-left truncate max-w-[160px] cursor-pointer"
                  title={`Select ${m}`}
                >
                  {m}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomModel(provider, m)}
                  className="text-slate-400 hover:text-rose-600 transition ml-0.5 text-xs font-bold leading-none cursor-pointer"
                  title={`Remove ${m} from permanent custom models`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {fetchErr && (
          <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg mt-1 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-all">{fetchErr}</span>
          </div>
        )}
      </div>
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
              { id: 'ollama', title: 'Ollama', desc: 'Local & Private (Llama 3.3)' },
              { id: 'gemini', title: 'Gemini', desc: 'Google 2.5 / 2.0 Flash' },
              { id: 'openai', title: 'OpenAI', desc: 'GPT-4o / o3-mini' },
              { id: 'anthropic', title: 'Anthropic', desc: 'Claude 3.7 / 3.5' },
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
                {renderModelSelector('ollama')}
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

            {renderModelSelector('gemini')}
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

            {renderModelSelector('openai')}
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

            {renderModelSelector('anthropic')}
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
          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
            Engine: <strong className="text-slate-800 capitalize">{formData.provider}</strong>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-sky-700 font-mono text-[10px]">{getProviderModel(formData.provider)}</span>
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
