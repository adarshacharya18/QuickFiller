import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Plus,
  Trash2,
  ClipboardList,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { scanFormFields, extractJobMetadata, getCleanFormatHint, DetectedField, JobMetadata } from '../../utils/scanner';
import { setNativeInputValue, insertTextAtCursor, CursorTargetInfo } from '../../utils/autofill';
import { deriveJobPostingUrl, extractInlineJD } from '../../utils/jdResolver';
import { getStorageData, updateStorageData } from '../../utils/storage';
import { StorageData, CustomPasteItem } from '../../types/storage';
import { CandidateProfile } from '../../types/profile';
import { cleanCoverLetterOutput } from '../../utils/llm/coverLetterPrompt';

export const Drawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && (window as any).__QUICKFILLER_AUTO_OPEN__) {
      (window as any).__QUICKFILLER_AUTO_OPEN__ = false;
      return true;
    }
    return false;
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [standardFields, setStandardFields] = useState<DetectedField[]>([]);
  const [customQuestions, setCustomQuestions] = useState<DetectedField[]>([]);
  const [jobMetadata, setJobMetadata] = useState<JobMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'coverLetter' | 'autofill' | 'bank'>('questions');

  // Cover Letter Generator State
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [coverLetterJD, setCoverLetterJD] = useState('');
  const [coverLetterJDSource, setCoverLetterJDSource] = useState('');
  const [isResolvingJD, setIsResolvingJD] = useState(false);
  const [showJDInput, setShowJDInput] = useState(false);
  const [userJDInput, setUserJDInput] = useState('');
  const [userJDUrl, setUserJDUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'technical' | 'startup'>('professional');
  const [coverLetterLength, setCoverLetterLength] = useState<'concise' | 'standard' | 'detailed'>('standard');
  const [coverLetterCustomNote, setCoverLetterCustomNote] = useState('');
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState('');

  // Question answers state: { [fieldId]: string }
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [savedBankId, setSavedBankId] = useState<string | null>(null);
  const [autofillBanner, setAutofillBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [bankNotice, setBankNotice] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Active cursor tracking for direct-into-page insertions
  const lastFocusedCursorRef = useRef<CursorTargetInfo | null>(null);

  // Custom paste bank state
  const [bankSearch, setBankSearch] = useState('');
  const [isAddingSnippet, setIsAddingSnippet] = useState(false);
  const [newSnippetLabel, setNewSnippetLabel] = useState('');
  const [newSnippetValue, setNewSnippetValue] = useState('');

  const handleAddSnippet = async () => {
    if (!newSnippetLabel.trim() || !newSnippetValue.trim()) return;
    const newItem: CustomPasteItem = {
      id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: newSnippetLabel.trim(),
      value: newSnippetValue.trim(),
    };
    const current = storage?.customPasteBank || [];
    const updated = [newItem, ...current];
    await updateStorageData({ customPasteBank: updated });
    setStorage((prev) => (prev ? { ...prev, customPasteBank: updated } : prev));
    setNewSnippetLabel('');
    setNewSnippetValue('');
    setIsAddingSnippet(false);
  };

  const handleDeleteSnippet = async (id: string) => {
    const current = storage?.customPasteBank || [];
    const updated = current.filter((item) => item.id !== id);
    await updateStorageData({ customPasteBank: updated });
    setStorage((prev) => (prev ? { ...prev, customPasteBank: updated } : prev));
  };

  const handleSaveAnswerToPasteBank = async (label: string, value: string, id: string) => {
    const newItem: CustomPasteItem = {
      id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.slice(0, 60),
      value,
    };
    const current = storage?.customPasteBank || [];
    const updated = [newItem, ...current];
    await updateStorageData({ customPasteBank: updated });
    setStorage((prev) => (prev ? { ...prev, customPasteBank: updated } : prev));
    setSavedBankId(id);
    setTimeout(() => setSavedBankId(null), 2500);
  };

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

  // Listen for runtime commands (e.g. keyboard shortcut Alt+Shift+Q or popup launcher)
  useEffect(() => {
    const handleMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message?.type === 'TOGGLE_DRAWER') {
        setIsOpen((prev) => !prev);
        sendResponse?.({ success: true });
      } else if (message?.type === 'OPEN_DRAWER') {
        setIsOpen(true);
        sendResponse?.({ success: true });
      } else if (message?.type === 'CLOSE_DRAWER') {
        setIsOpen(false);
        sendResponse?.({ success: true });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, []);

  // Track focused element and cursor position on the host page
  useEffect(() => {
    const isInsideDrawer = (node: Node | null): boolean => {
      if (!node) return false;
      let curr: Node | null = node;
      while (curr) {
        if (curr instanceof Element && curr.tagName.toLowerCase() === 'quickfiller-drawer') {
          return true;
        }
        if (curr instanceof ShadowRoot && curr.host?.tagName.toLowerCase() === 'quickfiller-drawer') {
          return true;
        }
        curr = curr.parentNode || (curr as ShadowRoot).host || null;
      }
      return false;
    };

    const updateCursorTarget = (target: EventTarget | null) => {
      let el: HTMLElement | null = null;
      if (target instanceof HTMLElement) {
        el = target;
      } else if (document.activeElement instanceof HTMLElement) {
        el = document.activeElement;
      }

      if (!el || isInsideDrawer(el)) {
        return;
      }

      const tagName = el.tagName?.toUpperCase();
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
      const isEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

      if (isInput || isEditable) {
        let start: number | null = null;
        let end: number | null = null;
        if (isInput) {
          try {
            start = (el as HTMLInputElement).selectionStart;
            end = (el as HTMLInputElement).selectionEnd;
          } catch {
            // Unsupported input types like email/number
          }
        }
        lastFocusedCursorRef.current = {
          element: el,
          selectionStart: start,
          selectionEnd: end,
        };
      }
    };

    const handleFocusIn = (e: FocusEvent) => updateCursorTarget(e.target);
    const handleSelectionChange = () => updateCursorTarget(document.activeElement);
    const handleMouseUp = (e: MouseEvent) => updateCursorTarget(e.target);
    const handleKeyUp = (e: KeyboardEvent) => updateCursorTarget(e.target);

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keyup', handleKeyUp, true);
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

  const handleInsertAtCursor = (text: string, id: string) => {
    if (!text) return;
    const success = insertTextAtCursor(text, lastFocusedCursorRef.current);
    if (success) {
      setInsertedId(id);
      setTimeout(() => setInsertedId(null), 2000);
      setBankNotice({
        type: 'success',
        message: 'Inserted text into active field at cursor position!',
      });
      setTimeout(() => setBankNotice(null), 3000);
      setTimeout(scanPage, 200);
    } else {
      // Fallback: Copy to clipboard and display instruction notice
      handleCopy(text, id);
      setBankNotice({
        type: 'info',
        message: 'No input selected on page — copied to clipboard! Click an input to insert.',
      });
      setTimeout(() => setBankNotice(null), 3500);
    }
  };

  // Sync target role & company when page metadata updates
  useEffect(() => {
    if (jobMetadata) {
      if (!targetCompany && jobMetadata.company) setTargetCompany(jobMetadata.company);
      if (!targetRole && jobMetadata.title) setTargetRole(jobMetadata.title);
    }
  }, [jobMetadata]);

  // Auto-resolve JD when user switches to Cover Letter tab
  useEffect(() => {
    if (activeTab === 'coverLetter' && !coverLetterJD && !userJDInput && !isResolvingJD) {
      resolveJobDescription();
    }
  }, [activeTab]);

  // 1. Multi-tier JD Resolver
  const resolveJobDescription = async () => {
    setIsResolvingJD(true);

    // Tier 1: Check Current Page DOM
    const inline = extractInlineJD(document);
    if (inline && inline.jdText) {
      setCoverLetterJD(inline.jdText);
      setCoverLetterJDSource('Current Page');
      if (inline.title && !targetRole) setTargetRole(inline.title);
      setShowJDInput(false);
      setIsResolvingJD(false);
      return;
    }

    // Tier 2: Check ATS URL Heuristic
    const derivedUrl = deriveJobPostingUrl(window.location.href);
    if (derivedUrl) {
      try {
        const resp = await chrome.runtime.sendMessage({
          type: 'FETCH_EXTERNAL_JD',
          url: derivedUrl,
        });
        if (resp?.success && resp.isValid && resp.jdText) {
          setCoverLetterJD(resp.jdText);
          setCoverLetterJDSource('Job Posting Link');
          if (resp.title && !targetRole) setTargetRole(resp.title);
          setShowJDInput(false);
          setIsResolvingJD(false);
          return;
        }
      } catch {}
    }

    // Tier 3: Check Opener Tab URL or Document Referrer
    let candidateUrl: string | undefined = undefined;
    try {
      const tabSource = await chrome.runtime.sendMessage({ type: 'GET_TAB_SOURCE_URL' });
      if (tabSource?.success && tabSource.url) {
        candidateUrl = tabSource.url;
      }
    } catch {}

    if (!candidateUrl && document.referrer && document.referrer.startsWith('http')) {
      candidateUrl = document.referrer;
    }

    if (candidateUrl) {
      try {
        const resp = await chrome.runtime.sendMessage({
          type: 'FETCH_EXTERNAL_JD',
          url: candidateUrl,
        });
        if (resp?.success && resp.isValid && resp.jdText) {
          setCoverLetterJD(resp.jdText);
          setCoverLetterJDSource('Previous Page / Referrer');
          if (resp.title && !targetRole) setTargetRole(resp.title);
          setShowJDInput(false);
          setIsResolvingJD(false);
          return;
        }
      } catch {}
    }

    // Tier 4: Fallback - Ask user for JD
    setIsResolvingJD(false);
    setShowJDInput(true);
  };

  // 2. Fetch User-Pasted URL
  const handleFetchUserUrl = async () => {
    if (!userJDUrl.trim()) return;
    setIsFetchingUrl(true);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_JD',
        url: userJDUrl.trim(),
      });
      if (resp?.success && resp.jdText) {
        setCoverLetterJD(resp.jdText);
        setCoverLetterJDSource(`Fetched from ${new URL(userJDUrl.trim()).hostname}`);
        if (resp.title && !targetRole) {
          setTargetRole(resp.title);
        }
        setShowJDInput(false);
        setBankNotice({ type: 'success', message: 'Job Description fetched successfully!' });
        setTimeout(() => setBankNotice(null), 3000);
      } else {
        setBankNotice({
          type: 'info',
          message: 'Could not extract JD from that URL. Please paste the JD text directly.',
        });
        setTimeout(() => setBankNotice(null), 4000);
      }
    } catch {
      setBankNotice({
        type: 'info',
        message: 'Failed to fetch link. Please paste the JD text directly.',
      });
      setTimeout(() => setBankNotice(null), 4000);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // 3. Generate Cover Letter
  const handleGenerateCoverLetter = async () => {
    const jdToUse = coverLetterJD.trim() || userJDInput.trim();
    if (!jdToUse) {
      setShowJDInput(true);
      setBankNotice({
        type: 'info',
        message: 'Please provide or paste a Job Description first.',
      });
      setTimeout(() => setBankNotice(null), 3500);
      return;
    }

    setIsGeneratingCoverLetter(true);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        options: {
          company: targetCompany.trim() || jobMetadata?.company || 'Company',
          role: targetRole.trim() || jobMetadata?.title || 'Position',
          jobDescription: jdToUse,
          tone: coverLetterTone,
          length: coverLetterLength,
          customNote: coverLetterCustomNote,
        },
      });

      if (resp?.success && resp.answer) {
        setGeneratedCoverLetter(cleanCoverLetterOutput(resp.answer));
      } else {
        setBankNotice({
          type: 'info',
          message: resp?.error || 'Failed to generate cover letter. Check LLM settings.',
        });
        setTimeout(() => setBankNotice(null), 4000);
      }
    } catch (err: any) {
      setBankNotice({
        type: 'info',
        message: err.message || 'Error generating cover letter',
      });
      setTimeout(() => setBankNotice(null), 4000);
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  // 4. Insert Cover Letter into form or at cursor
  const handleInsertCoverLetter = (letter: string) => {
    const cleanText = cleanCoverLetterOutput(letter);
    if (!cleanText) return;
    const clField = customQuestions.find((q) => q.type === 'cover_letter');
    if (clField) {
      handleInsert(clField, cleanText);
      setInsertedId('cover_letter_btn');
      setTimeout(() => setInsertedId(null), 2000);
      return;
    }

    handleInsertAtCursor(cleanText, 'cover_letter_btn');
  };

  // 5. Save Cover Letter to Bank
  const handleSaveCoverLetterToBank = async (letter: string) => {
    const cleanText = cleanCoverLetterOutput(letter);
    if (!cleanText) return;
    const company = targetCompany.trim() || jobMetadata?.company || 'Company';
    const role = targetRole.trim() || jobMetadata?.title || 'Role';
    await handleSaveAnswerToPasteBank(`Cover Letter: ${role} at ${company}`, cleanText, 'cover_letter_save');
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

    const cleanFormat = getCleanFormatHint(field.placeholder);

    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_ANSWER',
        questionPrompt: field.label || field.placeholder,
        placeholder: cleanFormat || field.placeholder || '',
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
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-1.5 bg-sky-500/15 border border-sky-500/30 rounded-lg flex-shrink-0">
                <Zap className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="font-semibold text-xs sm:text-sm text-slate-100 flex-shrink-0">
                    QuickFiller Copilot
                  </h3>
                  <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 border border-slate-700 flex-shrink-0 truncate max-w-[120px] sm:max-w-[220px]">
                    {storage?.llmSettings.provider === 'ollama'
                      ? storage.llmSettings.ollama.model || 'Ollama'
                      : storage?.llmSettings.provider || 'AI'}
                  </span>
                </div>
                {jobMetadata?.title && (
                  <p className="text-[10px] text-slate-400 break-words line-clamp-1 max-w-full">
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
              { id: 'questions', label: 'Answers', count: customQuestions.length },
              { id: 'coverLetter', label: 'Cover Letter', count: null },
              { id: 'autofill', label: 'Autofill', count: standardFields.length },
              { id: 'bank', label: 'Paste Bank', count: (storage?.customPasteBank?.length || 0) > 0 ? storage!.customPasteBank.length : null },
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
                    const formatHint = getCleanFormatHint(field.placeholder);

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

                          {formatHint && (
                            <div className="w-full text-[10px] text-slate-600 font-mono bg-slate-100/90 border border-slate-200/70 px-2.5 py-1.5 rounded-md leading-relaxed break-words whitespace-normal select-text">
                              <span className="font-semibold text-slate-700 mr-1.5 flex-shrink-0">Format:</span>
                              <span className="text-slate-600 break-words">{formatHint}</span>
                            </div>
                          )}

                          {field.type === 'cover_letter' && (
                            <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FileText className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                                <span className="text-[11px] font-medium text-sky-900 truncate">
                                  Cover letter field detected
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('coverLetter')}
                                className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 whitespace-nowrap underline"
                              >
                                Tailor with JD &rarr;
                              </button>
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
                            placeholder="Click 'Draft Answer' or write your response"
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-slate-800 bg-slate-50/50 focus:bg-white resize-y leading-relaxed"
                          />
                        ) : (
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            placeholder={formatHint || "Click 'Draft Answer' or write response"}
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
                                onClick={() => handleSaveAnswerToPasteBank(field.label, answer, field.id)}
                                title="Save answer to Paste Bank for 1-click re-use"
                                className="flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-md transition font-medium"
                              >
                                {savedBankId === field.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-sky-600" />
                                    <span className="text-sky-600">Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <ClipboardList className="w-3 h-3 text-sky-600" />
                                    <span>To Bank</span>
                                  </>
                                )}
                              </button>

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

            {/* TAB: Cover Letter Generator */}
            {activeTab === 'coverLetter' && (
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-800">Cover Letter Generator</h4>
                        <p className="text-[10px] text-slate-500">Auto-matches JD to your real projects</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resolveJobDescription}
                      disabled={isResolvingJD}
                      title="Re-scan previous page or current page for Job Description"
                      className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition"
                    >
                      <RefreshCw className={`w-3 h-3 ${isResolvingJD ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
                      <span>{isResolvingJD ? 'Scanning...' : 'Scan JD'}</span>
                    </button>
                  </div>

                  {/* Target Role & Company */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Target Role
                      </label>
                      <input
                        type="text"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="e.g. Senior Frontend Engineer"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 outline-none text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Target Company
                      </label>
                      <input
                        type="text"
                        value={targetCompany}
                        onChange={(e) => setTargetCompany(e.target.value)}
                        placeholder="e.g. Acme Corp"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 outline-none text-slate-800 font-medium"
                      />
                    </div>
                  </div>

                  {/* Job Description Status / Prompt */}
                  {isResolvingJD ? (
                    <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-2.5 text-xs text-sky-900 animate-in fade-in duration-150">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold block">Resolving Job Description...</span>
                        <span className="text-[10px] text-sky-700">Checking current page and previous link</span>
                      </div>
                    </div>
                  ) : coverLetterJD && !showJDInput ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Job Description Detected ({coverLetterJDSource || 'Auto-detected'})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowJDInput(true)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-medium"
                        >
                          Edit / Change
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-950/80 line-clamp-2 leading-relaxed">
                        {coverLetterJD.slice(0, 160)}...
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <span className="font-semibold text-amber-950 block">Job Description Needed</span>
                          <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                            Application forms usually don't include the job description. Paste the JD or enter the posting URL so the AI can match your background.
                          </p>
                        </div>
                      </div>

                      {/* Paste Link Input with Fetch button */}
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={userJDUrl}
                          onChange={(e) => setUserJDUrl(e.target.value)}
                          placeholder="Paste job posting link (e.g. linkedin.com/jobs/view/...)"
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white focus:border-amber-500 outline-none text-slate-800 placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={handleFetchUserUrl}
                          disabled={isFetchingUrl || !userJDUrl.trim()}
                          className="text-[11px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg font-medium transition flex-shrink-0 flex items-center gap-1"
                        >
                          {isFetchingUrl ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <span>Fetch JD</span>
                          )}
                        </button>
                      </div>

                      {/* Paste Text Area */}
                      <div>
                        <textarea
                          rows={3}
                          value={userJDInput}
                          onChange={(e) => setUserJDInput(e.target.value)}
                          placeholder="Or paste requirements, responsibilities, or bullet points..."
                          className="w-full text-xs p-2 rounded-lg border border-amber-200 bg-white focus:border-amber-500 outline-none text-slate-800 resize-y placeholder:text-slate-400 leading-relaxed"
                        />
                        {userJDInput.trim() && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCoverLetterJD(userJDInput.trim());
                                setCoverLetterJDSource('Pasted by user');
                                setShowJDInput(false);
                              }}
                              className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md font-medium transition"
                            >
                              Confirm JD
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tone & Length Selectors */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Tone
                      </label>
                      <select
                        value={coverLetterTone}
                        onChange={(e) => setCoverLetterTone(e.target.value as any)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                      >
                        <option value="professional">Professional &amp; Polished</option>
                        <option value="technical">Technical &amp; Systems Depth</option>
                        <option value="startup">High-Ownership &amp; Startup</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Length
                      </label>
                      <select
                        value={coverLetterLength}
                        onChange={(e) => setCoverLetterLength(e.target.value as any)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                      >
                        <option value="concise">Concise (~200 words)</option>
                        <option value="standard">Standard (~350 words)</option>
                        <option value="detailed">Detailed (~500 words)</option>
                      </select>
                    </div>
                  </div>

                  {/* Optional Focus Note */}
                  <div>
                    <input
                      type="text"
                      value={coverLetterCustomNote}
                      onChange={(e) => setCoverLetterCustomNote(e.target.value)}
                      placeholder="Optional focus (e.g. emphasize real-time audio copilot project)"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 outline-none text-slate-800 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Generate Button */}
                  <button
                    type="button"
                    disabled={isGeneratingCoverLetter || isResolvingJD}
                    onClick={handleGenerateCoverLetter}
                    className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Sparkles className={`w-4 h-4 ${isGeneratingCoverLetter ? 'animate-spin' : ''}`} />
                    <span>
                      {isGeneratingCoverLetter
                        ? 'Drafting Tailored Cover Letter...'
                        : generatedCoverLetter
                        ? 'Regenerate Cover Letter'
                        : 'Generate Cover Letter'}
                    </span>
                  </button>
                </div>

                {/* Generated Output Card */}
                {generatedCoverLetter && (
                  <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-600" />
                        Tailored Cover Letter
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {generatedCoverLetter.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl max-h-80 overflow-y-auto select-text">
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {generatedCoverLetter}
                      </p>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleSaveCoverLetterToBank(generatedCoverLetter)}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex items-center gap-1"
                      >
                        {savedBankId === 'cover_letter_save' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Saved to Bank</span>
                          </>
                        ) : (
                          <>
                            <ClipboardList className="w-3 h-3 text-slate-500" />
                            <span>To Bank</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedCoverLetter, 'cover_letter_copy')}
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex items-center gap-1"
                        >
                          {copiedId === 'cover_letter_copy' ? (
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

                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleInsertCoverLetter(generatedCoverLetter)}
                          className="text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-md transition flex items-center gap-1"
                        >
                          {insertedId === 'cover_letter_btn' ? (
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
                  </div>
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
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-medium text-xs text-slate-900 break-words flex-1 min-w-0">
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
                          <div className="flex items-start gap-1.5 text-[11px] min-w-0">
                            <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">Value:</span>
                            {resolvedVal ? (
                              <span className="font-mono text-[10px] text-sky-800 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md min-w-0 flex-1 break-all leading-snug select-text" title={resolvedVal}>
                                {resolvedVal}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 italic break-words min-w-0">
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
            {activeTab === 'bank' && storage && (() => {
              const searchQuery = bankSearch.toLowerCase().trim();

              const customSnippets = (storage.customPasteBank || []).filter(
                (item) =>
                  !searchQuery ||
                  item.label.toLowerCase().includes(searchQuery) ||
                  item.value.toLowerCase().includes(searchQuery)
              );

              const standardItems = [
                { label: 'Work Authorization', value: storage.wizardAnswers.authorizedToWork },
                { label: 'Requires Sponsorship', value: storage.wizardAnswers.requireSponsorship },
                { label: 'Notice Period', value: storage.wizardAnswers.noticePeriod },
                { label: 'Desired Salary', value: storage.wizardAnswers.desiredSalary },
                { label: 'Open to Relocation', value: storage.wizardAnswers.openToRelocation },
                { label: 'Portfolio URL', value: storage.profile.personal.portfolioUrl || '' },
                { label: 'GitHub URL', value: storage.profile.personal.githubUrl || '' },
                { label: 'LinkedIn URL', value: storage.profile.personal.linkedinUrl || '' },
              ].filter(
                (item) =>
                  Boolean(item.value) &&
                  (!searchQuery ||
                    item.label.toLowerCase().includes(searchQuery) ||
                    item.value.toLowerCase().includes(searchQuery))
              );

              const questionBankItems = (storage.questionBank || []).filter(
                (q) =>
                  Boolean(q.questionPrompt && q.answer) &&
                  (!searchQuery ||
                    q.questionPrompt.toLowerCase().includes(searchQuery) ||
                    q.answer.toLowerCase().includes(searchQuery) ||
                    q.tags?.some((t) => t.toLowerCase().includes(searchQuery)))
              );

              const projectItems = (storage.profile.portfolioDetails.featuredProjects || []).filter(
                (proj) =>
                  !searchQuery ||
                  proj.title.toLowerCase().includes(searchQuery) ||
                  proj.description.toLowerCase().includes(searchQuery)
              );

              const totalResults =
                customSnippets.length + standardItems.length + questionBankItems.length + projectItems.length;

              return (
                <div className="space-y-3 text-xs">
                  {/* Top Bar with Add Snippet Button */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      1-click copy &amp; insert for reusable values.
                    </p>
                    <button
                      onClick={() => setIsAddingSnippet(!isAddingSnippet)}
                      className="flex items-center gap-1 text-[11px] bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium px-2.5 py-1 rounded-md transition flex-shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      {isAddingSnippet ? 'Cancel' : 'Add Snippet'}
                    </button>
                  </div>

                  {/* Inline Add Snippet Drawer Form */}
                  {isAddingSnippet && (
                    <div className="p-3 bg-white border border-sky-200 rounded-xl shadow-xs space-y-2 animate-in fade-in duration-150">
                      <h5 className="font-semibold text-xs text-sky-950">New Custom Snippet</h5>
                      <input
                        type="text"
                        value={newSnippetLabel}
                        onChange={(e) => setNewSnippetLabel(e.target.value)}
                        placeholder="Label (e.g. LeetCode Profile, Cover Hook)"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                      />
                      <textarea
                        rows={2}
                        value={newSnippetValue}
                        onChange={(e) => setNewSnippetValue(e.target.value)}
                        placeholder="Value or URL to copy/paste..."
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800 resize-y"
                      />
                      <div className="flex justify-end gap-1.5 pt-0.5">
                        <button
                          onClick={() => setIsAddingSnippet(false)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md transition font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSnippet}
                          disabled={!newSnippetLabel.trim() || !newSnippetValue.trim()}
                          className="text-[11px] bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-md transition font-medium disabled:opacity-50"
                        >
                          Save Snippet
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search / Filter Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Search snippets, answers, or links..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500 text-slate-800"
                    />
                  </div>

                  {bankNotice && (
                    <div
                      className={`p-2 rounded-lg text-xs flex items-center gap-2 border animate-in fade-in duration-150 ${
                        bankNotice.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {bankNotice.type === 'success' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                      )}
                      <span className="font-medium text-[11px] leading-tight">{bankNotice.message}</span>
                    </div>
                  )}

                  {totalResults === 0 && (
                    <div className="text-center py-8 text-slate-400 space-y-1">
                      <p className="font-medium text-xs text-slate-600">No matching snippets found</p>
                      <p className="text-[11px]">
                        {searchQuery ? `No results for "${searchQuery}"` : 'Add snippets using "Add Snippet" above or in Settings.'}
                      </p>
                    </div>
                  )}

                  {/* SECTION 1: User Custom Snippets */}
                  {customSnippets.length > 0 && (
                    <div className="space-y-1.5">
                      <h5 className="font-semibold text-[10px] text-sky-800 px-0.5 uppercase tracking-wider flex items-center justify-between">
                        <span>Custom Snippets ({customSnippets.length})</span>
                      </h5>
                      {customSnippets.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 p-2.5 bg-white border border-sky-100 rounded-xl shadow-xs hover:border-sky-300 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider block">
                              {item.label}
                            </span>
                            <span className="text-xs font-medium text-slate-800 break-all block mt-0.5 select-text font-mono text-[11px]">
                              {item.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleInsertAtCursor(item.value, item.id)}
                              title="Insert at cursor into active form input"
                              className="flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-1 rounded-md transition"
                            >
                              {insertedId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Inserted</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-3 h-3 text-sky-600" />
                                  <span>Insert</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.value, item.id)}
                              title="Copy to clipboard"
                              className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
                            >
                              {copiedId === item.id ? (
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
                            <button
                              type="button"
                              onClick={() => handleDeleteSnippet(item.id)}
                              title="Delete snippet"
                              className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SECTION 2: Standard Screening Answers */}
                  {standardItems.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <h5 className="font-semibold text-[10px] text-slate-400 px-0.5 uppercase tracking-wider">
                        Standard Answers ({standardItems.length})
                      </h5>
                      {standardItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2.5 p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs hover:border-slate-300 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              {item.label}
                            </span>
                            <span className="text-xs font-medium text-slate-800 break-all block mt-0.5 select-text">
                              {item.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleInsertAtCursor(item.value, `std_${idx}`)}
                              title="Insert at cursor into active form input"
                              className="flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-1 rounded-md transition"
                            >
                              {insertedId === `std_${idx}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Inserted</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-3 h-3 text-sky-600" />
                                  <span>Insert</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.value, `std_${idx}`)}
                              title="Copy to clipboard"
                              className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
                            >
                              {copiedId === `std_${idx}` ? (
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
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SECTION 3: Approved Q&A Bank */}
                  {questionBankItems.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <h5 className="font-semibold text-[10px] text-slate-400 px-0.5 uppercase tracking-wider">
                        Approved Q&amp;A Answers ({questionBankItems.length})
                      </h5>
                      {questionBankItems.map((q) => (
                        <div
                          key={q.id}
                          className="p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-1 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-800 break-words flex-1 min-w-0">
                              {q.questionPrompt}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleInsertAtCursor(q.answer, q.id)}
                                title="Insert at cursor into active form input"
                                className="flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md transition font-medium"
                              >
                                {insertedId === q.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600 font-semibold">Inserted</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownToLine className="w-3 h-3 text-sky-600" />
                                    <span>Insert</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(q.answer, q.id)}
                                title="Copy to clipboard"
                                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition font-medium"
                              >
                                {copiedId === q.id ? (
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
                          </div>
                          <p className="text-[11px] text-slate-600 break-words leading-relaxed select-text">
                            {q.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SECTION 4: Portfolio Projects */}
                  {projectItems.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <h5 className="font-semibold text-[10px] text-slate-400 px-0.5 uppercase tracking-wider">
                        Portfolio Projects ({projectItems.length})
                      </h5>
                      {projectItems.map((proj) => {
                        const projectSnippet = `${proj.title}: ${proj.description}${
                          proj.url ? ' (' + proj.url + ')' : proj.githubUrl ? ' (' + proj.githubUrl + ')' : ''
                        }`;

                        return (
                          <div
                            key={proj.id}
                            className="p-2.5 bg-white border border-slate-200/80 rounded-xl space-y-1 shadow-xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-slate-800 break-words flex-1 min-w-0">
                                {proj.title}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleInsertAtCursor(projectSnippet, proj.id)}
                                  title="Insert at cursor into active form input"
                                  className="flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md transition font-medium"
                                >
                                  {insertedId === proj.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-600 font-semibold">Inserted</span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownToLine className="w-3 h-3 text-sky-600" />
                                      <span>Insert</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(projectSnippet, proj.id)}
                                  title="Copy to clipboard"
                                  className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition font-medium"
                                >
                                  {copiedId === proj.id ? (
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
                            </div>
                            <p className="text-[11px] text-slate-600 break-words leading-relaxed select-text">
                              {proj.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
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
