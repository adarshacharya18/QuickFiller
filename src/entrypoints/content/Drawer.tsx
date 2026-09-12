import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  RefreshCw,
  Zap,
  ArrowDownToLine,
  ExternalLink,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { scanFormFields, extractJobMetadata, DetectedField, JobMetadata } from '../../utils/scanner';
import { setNativeInputValue } from '../../utils/autofill';
import { getStorageData } from '../../utils/storage';
import { StorageData } from '../../types/storage';
import { CandidateProfile } from '../../types/profile';

export const Drawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [standardFields, setStandardFields] = useState<DetectedField[]>([]);
  const [customQuestions, setCustomQuestions] = useState<DetectedField[]>([]);
  const [jobMetadata, setJobMetadata] = useState<JobMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'autofill' | 'bank'>('questions');

  // Question answers state: { [fieldId]: string }
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [autofillBanner, setAutofillBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Scan page and load storage
  const scanPage = () => {
    const { standardFields: std, customQuestions: cq } = scanFormFields();
    setStandardFields(std);
    setCustomQuestions(cq);
    setJobMetadata(extractJobMetadata());
  };

  const refreshStorage = async () => {
    const data = await getStorageData();
    setStorage(data);
    return data;
  };

  useEffect(() => {
    refreshStorage();
    scanPage();

    // 1. Periodically re-scan form for dynamic SPAs
    const interval = setInterval(scanPage, 3500);

    // 2. Real-time sync: Listen for storage changes from Options page
    const handleStorageChange = (
      _changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local') {
        refreshStorage();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // 3. Refresh storage when user switches back to this tab
    const handleWindowFocus = () => {
      refreshStorage();
      scanPage();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(interval);
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const resolveFieldValue = (field: DetectedField, profile?: CandidateProfile): string => {
    if (!profile) return '';
    const p = profile.personal;

    switch (field.type) {
      case 'firstName':
        return p.firstName || '';
      case 'lastName':
        return p.lastName || '';
      case 'fullName':
        return `${p.firstName} ${p.lastName}`.trim() || p.firstName || '';
      case 'email':
        return p.email || '';
      case 'phone':
        return p.phone || '';
      case 'city':
        return p.city || '';
      case 'state':
        return p.state || '';
      case 'postalCode':
        return p.postalCode || '';
      case 'linkedin':
        return p.linkedinUrl || '';
      case 'github':
        return p.githubUrl || '';
      case 'portfolio':
        return p.portfolioUrl || profile.portfolioDetails?.url || '';
      default:
        return '';
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = async (field: DetectedField, text: string) => {
    if (!text) return;

    let target: HTMLInputElement | HTMLTextAreaElement | null = null;
    if (field.element && document.body.contains(field.element)) {
      target = field.element;
    } else {
      try {
        target = document.getElementById(field.id) as any;
      } catch {}
      if (!target && field.id) {
        try {
          target = document.querySelector(`[name="${CSS.escape(field.id)}"]`) as any;
        } catch {}
      }
    }

    if (target) {
      setNativeInputValue(target, text);
      setInsertedId(field.id);
      setTimeout(() => setInsertedId(null), 2000);
      setTimeout(scanPage, 150);
    }
  };

  const autofillAllStandard = async () => {
    setAutofillBanner(null);
    const currentStorage = await refreshStorage();
    const profile = currentStorage.profile;

    const hasProfileData = Boolean(
      profile.personal.firstName ||
        profile.personal.email ||
        profile.personal.phone ||
        profile.personal.linkedinUrl
    );

    if (!hasProfileData) {
      setAutofillBanner({
        type: 'warning',
        message: 'Your profile is empty! Click "Open Options" below to add your details first.',
      });
      return;
    }

    let filledCount = 0;

    standardFields.forEach((field) => {
      const val = resolveFieldValue(field, profile);
      if (!val) return;

      let target: HTMLInputElement | HTMLTextAreaElement | null = null;
      if (field.element && document.body.contains(field.element)) {
        target = field.element;
      } else {
        try {
          target = document.getElementById(field.id) as any;
        } catch {}
        if (!target && field.id) {
          try {
            target = document.querySelector(`[name="${CSS.escape(field.id)}"]`) as any;
          } catch {}
        }
      }

      if (target) {
        const ok = setNativeInputValue(target, val);
        if (ok) filledCount++;
      }
    });

    if (filledCount > 0) {
      setAutofillBanner({
        type: 'success',
        message: `Successfully autofilled ${filledCount} field${filledCount > 1 ? 's' : ''}!`,
      });
    } else {
      setAutofillBanner({
        type: 'info',
        message: 'No matching profile values found for detected fields on this page.',
      });
    }

    setTimeout(scanPage, 200);
  };

  const generateAnswerForField = (field: DetectedField, instructions?: string) => {
    setGenerating((prev) => ({ ...prev, [field.id]: true }));

    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_ANSWER',
        questionPrompt: field.label || field.placeholder,
        placeholder: field.placeholder || '',
        isTextarea: field.isTextarea,
        jobContext: jobMetadata,
        customInstructions: instructions,
      },
      (res) => {
        setGenerating((prev) => ({ ...prev, [field.id]: false }));
        if (res?.success && res.answer) {
          setAnswers((prev) => ({ ...prev, [field.id]: res.answer }));
        } else {
          alert(`Error generating answer: ${res?.error || 'Unknown error'}`);
        }
      }
    );
  };

  const totalFields = standardFields.length + customQuestions.length;

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-[2147483647] font-sans text-slate-800 text-sm">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            scanPage();
          }}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-2xl border border-slate-700 transition-all hover:scale-105 active:scale-95"
        >
          <Zap className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="font-semibold text-xs tracking-wide">QuickFiller</span>
          {totalFields > 0 && (
            <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded-full border border-sky-400/30">
              {totalFields}
            </span>
          )}
        </button>
      )}

      {/* Expanded Copilot Drawer */}
      {isOpen && (
        <div
          className={`flex flex-col transition-all duration-200 ease-in-out bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden ${
            isExpanded
              ? 'w-[580px] sm:w-[680px] max-w-[calc(100vw-24px)] h-[640px] sm:h-[680px] max-h-[92vh]'
              : 'w-[380px] sm:w-[440px] max-w-[calc(100vw-24px)] h-[580px] sm:h-[620px] max-h-[90vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-sky-500/15 border border-sky-500/30 rounded-lg flex-shrink-0">
                <Zap className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                    QuickFiller Copilot
                  </h3>
                  <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 border border-slate-700 flex-shrink-0 truncate max-w-[110px] sm:max-w-[150px]">
                    {storage?.llmSettings.provider === 'ollama'
                      ? storage.llmSettings.ollama.model || 'Ollama'
                      : storage?.llmSettings.provider || 'AI'}
                  </span>
                </div>
                {jobMetadata?.title && (
                  <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-[340px]">
                    {jobMetadata.title} {jobMetadata.company ? `• ${jobMetadata.company}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse width' : 'Expand to wide view'}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={scanPage}
                title="Rescan form"
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 pt-1.5 gap-1">
            {[
              { id: 'questions', label: 'AI Answers', count: customQuestions.length },
              { id: 'autofill', label: 'Autofill', count: standardFields.length },
              { id: 'bank', label: 'Paste Bank', count: null },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium border-b-2 transition-all rounded-t-md ${
                    isActive
                      ? 'border-sky-600 text-sky-600 font-semibold bg-white shadow-xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-sky-100 text-sky-700 font-semibold'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-3.5 space-y-3 bg-slate-50/50">
            {/* TAB 1: Screening Questions */}
            {activeTab === 'questions' && (
              <div className="space-y-3">
                {customQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Sparkles className="w-7 h-7 mx-auto text-slate-300" />
                    <p className="font-medium text-xs sm:text-sm text-slate-600">
                      No custom questions detected
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Navigate to an application form or use the Autofill tab.
                    </p>
                  </div>
                ) : (
                  customQuestions.map((field) => {
                    const answer = answers[field.id] || field.value || '';
                    const isGen = generating[field.id] || false;

                    return (
                      <div
                        key={field.id}
                        className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-2.5 min-w-0 overflow-hidden"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <label className="text-xs font-semibold text-slate-800 leading-snug break-words min-w-0 flex-1">
                              {field.label}
                            </label>
                            <button
                              disabled={isGen}
                              onClick={() => generateAnswerForField(field)}
                              className="flex items-center gap-1 text-[11px] bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium px-2 py-1 rounded-md transition disabled:opacity-50 flex-shrink-0"
                            >
                              <Sparkles className={`w-3 h-3 ${isGen ? 'animate-spin' : ''}`} />
                              {answer ? 'Regenerate' : 'Draft Answer'}
                            </button>
                          </div>

                          {field.placeholder && (
                            <div className="w-full text-[10px] text-slate-500 font-mono bg-slate-100/90 border border-slate-200/70 px-2.5 py-1 rounded-md leading-relaxed break-words">
                              <span className="font-semibold text-slate-700 mr-1.5">Format:</span>
                              <span className="text-slate-600">{field.placeholder}</span>
                            </div>
                          )}
                        </div>

                        {/* Answer input or textarea depending on field.isTextarea */}
                        {field.isTextarea ? (
                          <textarea
                            rows={3}
                            value={answer}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            placeholder="Click 'Draft Answer' or write your response..."
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-slate-800 bg-slate-50/50 focus:bg-white resize-y leading-relaxed"
                          />
                        ) : (
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            placeholder={field.placeholder || "Click 'Draft Answer' or write response..."}
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-slate-800 bg-slate-50/50 focus:bg-white"
                          />
                        )}

                        {/* Actions */}
                        {answer && (
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  generateAnswerForField(field, 'Make the answer more concise and punchy.')
                                }
                                className="text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition font-medium"
                              >
                                Shorter
                              </button>
                              <button
                                onClick={() =>
                                  generateAnswerForField(
                                    field,
                                    'Highlight specific portfolio project achievements and include the project link.'
                                  )
                                }
                                className="text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition font-medium"
                              >
                                Add Project
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopy(answer, field.id)}
                                className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition font-medium"
                              >
                                {copiedId === field.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleInsert(field, answer)}
                                className="flex items-center gap-1 text-[11px] bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-md font-medium transition"
                              >
                                {insertedId === field.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-sky-400" />
                                    <span>Inserted</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownToLine className="w-3 h-3" />
                                    <span>Insert</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: Standard Autofill */}
            {activeTab === 'autofill' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-sky-50/70 border border-sky-100 rounded-xl">
                  <div>
                    <h4 className="font-semibold text-xs text-sky-950">1-Click Autofill</h4>
                    <p className="text-[11px] text-sky-700">
                      Fills detected standard inputs from your profile.
                    </p>
                  </div>
                  <button
                    onClick={autofillAllStandard}
                    className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-xs transition active:scale-95 flex-shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Fill All ({standardFields.length})
                  </button>
                </div>

                {autofillBanner && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-150 ${
                      autofillBanner.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : autofillBanner.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}
                  >
                    {autofillBanner.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="font-medium text-[11px]">{autofillBanner.message}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {standardFields.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-2">
                      <p className="font-medium text-slate-600">No standard fields detected</p>
                      <p className="text-xs">Navigate to a job application form with text inputs.</p>
                    </div>
                  ) : (
                    standardFields.map((field) => {
                      const resolvedVal = resolveFieldValue(field, storage?.profile);

                      return (
                        <div
                          key={field.id}
                          className="p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-1.5 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-xs text-slate-900 truncate">
                                {field.label}
                              </span>
                              <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded capitalize flex-shrink-0">
                                {field.type}
                              </span>
                            </div>

                            <button
                              disabled={!resolvedVal}
                              onClick={() => handleInsert(field, resolvedVal)}
                              className="text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1 rounded-md transition flex items-center gap-1 flex-shrink-0"
                            >
                              {insertedId === field.id ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Inserted
                                </span>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-3 h-3 text-slate-500" />
                                  <span>Insert</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Value Preview */}
                          <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                            <span className="text-[10px] text-slate-400 flex-shrink-0">Value:</span>
                            {resolvedVal ? (
                              <span className="font-mono text-[10px] text-sky-800 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md truncate min-w-0 flex-1 max-w-full" title={resolvedVal}>
                                {resolvedVal}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 italic truncate min-w-0">
                                Not in profile — add in Options
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Quick Paste Bank */}
            {activeTab === 'bank' && storage && (
              <div className="space-y-2 text-xs">
                <p className="text-[11px] text-slate-500 px-0.5">
                  Pre-configured answers for common screening filters.
                </p>

                {[
                  { label: 'Work Authorization', value: storage.wizardAnswers.authorizedToWork },
                  { label: 'Requires Sponsorship', value: storage.wizardAnswers.requireSponsorship },
                  { label: 'Notice Period', value: storage.wizardAnswers.noticePeriod },
                  { label: 'Desired Salary', value: storage.wizardAnswers.desiredSalary },
                  { label: 'Open to Relocation', value: storage.wizardAnswers.openToRelocation },
                  { label: 'Portfolio URL', value: storage.profile.personal.portfolioUrl || '' },
                  { label: 'GitHub URL', value: storage.profile.personal.githubUrl || '' },
                  { label: 'LinkedIn URL', value: storage.profile.personal.linkedinUrl || '' },
                ]
                  .filter((item) => Boolean(item.value))
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2.5 p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs hover:border-slate-300 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {item.label}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate block mt-0.5">
                          {item.value}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(item.value, `bank_${idx}`)}
                        className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex-shrink-0"
                      >
                        {copiedId === `bank_${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}

                {/* Featured Projects */}
                {storage.profile.portfolioDetails.featuredProjects.length > 0 && (
                  <div className="pt-2">
                    <h5 className="font-semibold text-xs text-slate-700 mb-1.5 px-0.5">
                      Portfolio Projects
                    </h5>
                    {storage.profile.portfolioDetails.featuredProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-2.5 mb-2 bg-white border border-slate-200/80 rounded-xl space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-slate-800 truncate">
                            {proj.title}
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(
                                `${proj.title}: ${proj.description} (${proj.url || proj.githubUrl || ''})`,
                                proj.id
                              )
                            }
                            className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition flex-shrink-0 font-medium"
                          >
                            {copiedId === proj.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {proj.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Options Link */}
          <div className="px-3.5 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">QuickFiller Copilot</span>
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium text-[11px]"
            >
              Open Options <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
