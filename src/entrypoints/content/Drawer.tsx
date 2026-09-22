import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  BookmarkPlus,
  CheckCircle,
  Briefcase,
  Send,
  UserCheck,
  Terminal,
  GripHorizontal,
  LocateFixed,
} from 'lucide-react';
import { OutreachPersona, OutreachResult } from '../../types/outreach';
import { generateAnswer } from '../../utils/llm';
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
} from '../../utils/llm/outreachPrompt';
import {
  scanFormFields,
  extractJobMetadata,
  getCleanFormatHint,
  isInsideQuickFillerDrawer,
  DetectedField,
  JobMetadata,
} from '../../utils/scanner';
import {
  setNativeInputValue,
  setNativeRadioChecked,
  insertTextAtCursor,
  resolveStandardFieldValue,
  CursorTargetInfo,
} from '../../utils/autofill';
import { cleanPhoneNumber, extractPhoneExtension } from '../../utils/phoneUtils';
import {
  DetectedRadioGroup,
  RadioOption,
  resolveRadioOption,
} from '../../utils/radioResolver';
import { deriveJobPostingUrl, extractInlineJD } from '../../utils/jdResolver';
import { getStorageData, updateStorageData, isExtensionValid } from '../../utils/storage';
import { StorageData, CustomPasteItem, defaultStorageData } from '../../types/storage';
import { CandidateProfile } from '../../types/profile';
import { JobApplication, ApplicationStatus } from '../../types/applications';
import { cleanCoverLetterOutput } from '../../utils/llm/coverLetterPrompt';
import { cleanAnswerOutput } from '../../utils/llm/prompt';
import { initSubmissionWatcher, extractApplicationPortalUrl, stageCurrentJobMetadata } from '../../utils/submissionWatcher';
import { isSafeWebUrl, sanitizeWebUrl } from '../../utils/security';

export const Drawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if ((window as any).__QUICKFILLER_AUTO_OPEN__) {
        (window as any).__QUICKFILLER_AUTO_OPEN__ = false;
        try {
          sessionStorage.setItem('quickfiller_drawer_open', 'true');
        } catch {}
        return true;
      }
      try {
        const stored = sessionStorage.getItem('quickfiller_drawer_open');
        if (stored === 'false') return false;
        if (stored === 'true') return true;
      } catch {}

      // On first visit / pin click access grant, open the drawer by default
      try {
        sessionStorage.setItem('quickfiller_drawer_open', 'true');
      } catch {}
      return true;
    }
    return false;
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('quickfiller_drawer_expanded');
        if (stored === 'false') return false;
        if (stored === 'true') return true;
      } catch {}

      // On first visit / pin click, default to expanded wide view
      try {
        sessionStorage.setItem('quickfiller_drawer_expanded', 'true');
      } catch {}
      return true;
    }
    return true;
  });
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [standardFields, setStandardFields] = useState<DetectedField[]>([]);
  const [customQuestions, setCustomQuestions] = useState<DetectedField[]>([]);
  const [radioGroups, setRadioGroups] = useState<DetectedRadioGroup[]>([]);
  const [jobMetadata, setJobMetadata] = useState<JobMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'autofill' | 'coverLetter' | 'outreach' | 'bank'>('autofill');
  const [autofillFilter, setAutofillFilter] = useState<'all' | 'questions' | 'standard' | 'radios'>('all');

  // Draggable Window State
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('quickfiller_drawer_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });
  const currentPosRef = useRef<{ x: number; y: number } | null>(customPosition);
  const drawerContainerRef = useRef<HTMLDivElement | null>(null);

  // Outreach Studio State
  const [outreachDraft, setOutreachDraft] = useState('');
  const [outreachPersona, setOutreachPersona] = useState<OutreachPersona>('recruiter');
  const [outreachTargetCompany, setOutreachTargetCompany] = useState('');
  const [outreachTargetRole, setOutreachTargetRole] = useState('');
  const [outreachContextNotes, setOutreachContextNotes] = useState('');
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null);
  const [outreachCopiedVariant, setOutreachCopiedVariant] = useState<'note' | 'pitch' | null>(null);
  const [outreachInsertedVariant, setOutreachInsertedVariant] = useState<'note' | 'pitch' | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const hasUserSelectedTab = useRef(false);

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
      value: cleanAnswerOutput(value),
    };
    const current = storage?.customPasteBank || [];
    const updated = [newItem, ...current];
    await updateStorageData({ customPasteBank: updated });
    setStorage((prev) => (prev ? { ...prev, customPasteBank: updated } : prev));
    setSavedBankId(id);
    setTimeout(() => setSavedBankId(null), 2500);
  };

  // Job Tracker State & Handlers
  const [showTrackerMenu, setShowTrackerMenu] = useState(false);
  const [justTrackedAnim, setJustTrackedAnim] = useState(false);
  const [autoTrackedToast, setAutoTrackedToast] = useState<JobApplication | null>(null);

  useEffect(() => {
    if (autoTrackedToast) {
      const timer = setTimeout(() => setAutoTrackedToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [autoTrackedToast]);

  const normalizeUrl = (urlStr?: string) => {
    if (!urlStr) return '';
    try {
      const u = new URL(urlStr);
      return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
    } catch {
      return urlStr.toLowerCase();
    }
  };

  const currentTrackedApp = useMemo(() => {
    if (!storage?.applications || storage.applications.length === 0) return null;
    const currentNorm = normalizeUrl(window.location.href);
    const byUrl = storage.applications.find((a) => normalizeUrl(a.url) === currentNorm);
    if (byUrl) return byUrl;

    if (jobMetadata?.company && jobMetadata?.title) {
      const compNorm = jobMetadata.company.trim().toLowerCase();
      const titleNorm = jobMetadata.title.trim().toLowerCase();
      return (
        storage.applications.find(
          (a) =>
            a.company.trim().toLowerCase() === compNorm &&
            a.title.trim().toLowerCase() === titleNorm
        ) || null
      );
    }
    return null;
  }, [storage?.applications, jobMetadata]);

  const handleTrackCurrentJob = async () => {
    const portalUrl = extractApplicationPortalUrl(document) || undefined;
    const newApp: JobApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company:
        jobMetadata?.company ||
        window.location.hostname.replace('www.', '').split('.')[0] ||
        'Company',
      title:
        (jobMetadata?.title && !/^(thank\s*you|application\s*(confirmation|submitted)|confirmation|success|applied)$/i.test(jobMetadata.title)
          ? jobMetadata.title
          : document.title.split(/[-|–]/)[0]?.trim()) ||
        'Job Application',
      url: deriveJobPostingUrl(window.location.href) || window.location.href,
      portalUrl,
      appliedDate: new Date().toISOString(),
      status: 'Applied',
      notes: '',
      updatedAt: new Date().toISOString(),
    };

    const currentApps = storage?.applications || [];
    const updated = [newApp, ...currentApps];
    await updateStorageData({ applications: updated });
    setStorage((prev) => (prev ? { ...prev, applications: updated } : prev));
    setJustTrackedAnim(true);
    setTimeout(() => setJustTrackedAnim(false), 2000);
  };

  const handleUpdateTrackedStatus = async (newStatus: ApplicationStatus) => {
    if (!currentTrackedApp) return;
    const currentApps = storage?.applications || [];
    const updated = currentApps.map((a) =>
      a.id === currentTrackedApp.id
        ? { ...a, status: newStatus, updatedAt: new Date().toISOString() }
        : a
    );
    await updateStorageData({ applications: updated });
    setStorage((prev) => (prev ? { ...prev, applications: updated } : prev));
    setShowTrackerMenu(false);
  };

  const handleRemoveTrackedJob = async () => {
    if (!currentTrackedApp) return;
    const currentApps = storage?.applications || [];
    const updated = currentApps.filter((a) => a.id !== currentTrackedApp.id);
    await updateStorageData({ applications: updated });
    setStorage((prev) => (prev ? { ...prev, applications: updated } : prev));
    setShowTrackerMenu(false);
  };

  const handleOpenOptionsPage = (tab: string = 'profile') => {
    try {
      if (isExtensionValid() && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'OPEN_OPTIONS_TAB', tab },
          (res) => {
            if (chrome.runtime?.lastError || !res?.success) {
              const targetUrl = chrome.runtime?.getURL
                ? chrome.runtime.getURL(`options.html?tab=${encodeURIComponent(tab)}#${encodeURIComponent(tab)}`)
                : 'options.html';
              window.open(targetUrl, '_blank');
            }
          }
        );
        return;
      }
    } catch {}

    const targetUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(`options.html?tab=${encodeURIComponent(tab)}#${encodeURIComponent(tab)}`)
      : 'options.html';
    window.open(targetUrl, '_blank');
  };

  const handleOpenJobTracker = () => {
    handleOpenOptionsPage('applications');
  };

  // Scan page and load storage
  const scanPage = () => {
    if (!isExtensionValid()) return;
    const { standardFields: std, customQuestions: cq, radioGroups: rg } = scanFormFields();
    setStandardFields(std);
    setCustomQuestions(cq);
    setRadioGroups(rg || []);
    const meta = extractJobMetadata();
    setJobMetadata(meta);
    if ((std.length > 0 || cq.length > 0) && meta.title && meta.title !== 'Job Application') {
      stageCurrentJobMetadata(meta, false);
    }

    // Auto-switch to outreach tab on non-job pages if user hasn't explicitly selected a tab
    const total = std.length + cq.length + (rg ? rg.length : 0);
    if (total === 0 && !hasUserSelectedTab.current) {
      setActiveTab((prev) => (prev === 'autofill' ? 'outreach' : prev));
    }
  };

  const refreshStorage = async () => {
    if (!isExtensionValid()) return defaultStorageData;
    const data = await getStorageData();
    setStorage(data);
    return data;
  };

  // Mount submission watcher to auto-track applications upon form submit or confirmation
  useEffect(() => {
    const unwatch = initSubmissionWatcher({
      onAutoTracked: (app) => {
        setAutoTrackedToast(app);
        refreshStorage();
      },
    });
    return () => unwatch();
  }, []);

  useEffect(() => {
    refreshStorage();
    scanPage();

    // 1. Periodically re-scan form for dynamic SPAs
    const interval = setInterval(() => {
      if (!isExtensionValid()) {
        clearInterval(interval);
        return;
      }
      scanPage();
    }, 3500);

    // 1b. Real-time DOM mutation observer for dynamic SPAs (Google Forms, Workday, etc.)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver((mutations) => {
        if (!isExtensionValid()) {
          observer?.disconnect();
          return;
        }
        const hasRelevant = mutations.some((m) =>
          Array.from(m.addedNodes).some(
            (n) => !isInsideQuickFillerDrawer(n) && n.nodeType === 1
          )
        );
        if (hasRelevant) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (isExtensionValid()) {
              scanPage();
            }
          }, 300);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch {}

    // 2. Real-time sync: Listen for storage changes from Options page
    const handleStorageChange = (
      _changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (!isExtensionValid()) return;
      if (area === 'local') {
        refreshStorage();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      try {
        chrome.storage.onChanged.addListener(handleStorageChange);
      } catch {}
    }

    // 3. Refresh storage when user switches back to this tab
    const handleWindowFocus = () => {
      if (!isExtensionValid()) return;
      refreshStorage();
      scanPage();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      try {
        observer?.disconnect();
      } catch {}
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
          chrome.storage.onChanged.removeListener(handleStorageChange);
        }
      } catch {}
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
        setIsOpen((prev) => {
          const next = !prev;
          try {
            sessionStorage.setItem('quickfiller_drawer_open', next ? 'true' : 'false');
          } catch {}
          if (next) setTimeout(scanPage, 50);
          return next;
        });
        sendResponse?.({ success: true });
      } else if (message?.type === 'OPEN_DRAWER') {
        setIsOpen(true);
        try {
          sessionStorage.setItem('quickfiller_drawer_open', 'true');
        } catch {}
        setTimeout(scanPage, 50);
        sendResponse?.({ success: true });
      } else if (message?.type === 'CLOSE_DRAWER') {
        setIsOpen(false);
        try {
          sessionStorage.setItem('quickfiller_drawer_open', 'false');
        } catch {}
        sendResponse?.({ success: true });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      try {
        chrome.runtime.onMessage.addListener(handleMessage);
      } catch {}
    }
    return () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(handleMessage);
        }
      } catch {}
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

      // Check if target itself, ancestor, or child is an editable or input element (crucial for LinkedIn / rich text editors)
      const inputOrTextarea = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el : el.closest('input, textarea');
      const contentEditable = el.closest<HTMLElement>('[contenteditable="true"]') || (el.isContentEditable ? el : el.querySelector<HTMLElement>('[contenteditable="true"]'));
      const targetEl = (inputOrTextarea || contentEditable) as HTMLElement | null;

      if (targetEl && !isInsideDrawer(targetEl)) {
        el = targetEl;
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
    return resolveStandardFieldValue(field, profile);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(cleanAnswerOutput(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = async (field: DetectedField, text: string) => {
    const cleanText = cleanAnswerOutput(text);
    if (!cleanText) return;

    let target: HTMLInputElement | HTMLTextAreaElement | null = null;
    const isConnected = field.element && (field.element.isConnected ?? document.body.contains(field.element));
    if (isConnected) {
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
      setNativeInputValue(target, cleanText);
      setInsertedId(field.id);
      setTimeout(() => setInsertedId(null), 2000);
      setTimeout(scanPage, 150);
    }
  };

  const handleInsertAtCursor = (text: string, id: string) => {
    const cleanText = cleanAnswerOutput(text);
    if (!cleanText) return;
    const success = insertTextAtCursor(cleanText, lastFocusedCursorRef.current);
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
      if (inline.company && !targetCompany) setTargetCompany(inline.company);
      setShowJDInput(false);
      setIsResolvingJD(false);
      return;
    }

    // Tier 2: Check ATS URL Heuristic
    const derivedUrl = deriveJobPostingUrl(window.location.href);
    if (derivedUrl && isExtensionValid()) {
      try {
        const resp = await chrome.runtime.sendMessage({
          type: 'FETCH_EXTERNAL_JD',
          url: derivedUrl,
        });
        if (resp?.success && resp.isValid && resp.jdText) {
          setCoverLetterJD(resp.jdText);
          setCoverLetterJDSource('Job Posting Link');
          if (resp.title && !targetRole) setTargetRole(resp.title);
          if (resp.company && !targetCompany) setTargetCompany(resp.company);
          setShowJDInput(false);
          setIsResolvingJD(false);
          return;
        }
      } catch {}
    }

    // Tier 3: Check Opener Tab URL or Document Referrer
    let candidateUrl: string | undefined = undefined;
    if (isExtensionValid()) {
      try {
        const tabSource = await chrome.runtime.sendMessage({ type: 'GET_TAB_SOURCE_URL' });
        if (tabSource?.success && tabSource.url) {
          candidateUrl = tabSource.url;
        }
      } catch {}
    }

    if (!candidateUrl && document.referrer && document.referrer.startsWith('http')) {
      candidateUrl = document.referrer;
    }

    if (candidateUrl && isExtensionValid()) {
      try {
        const resp = await chrome.runtime.sendMessage({
          type: 'FETCH_EXTERNAL_JD',
          url: candidateUrl,
        });
        if (resp?.success && resp.isValid && resp.jdText) {
          setCoverLetterJD(resp.jdText);
          setCoverLetterJDSource('Previous Page / Referrer');
          if (resp.title && !targetRole) setTargetRole(resp.title);
          if (resp.company && !targetCompany) setTargetCompany(resp.company);
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
    if (!isExtensionValid()) {
      setBankNotice({
        type: 'info',
        message: 'Extension was reloaded. Please refresh the page to reconnect.',
      });
      setTimeout(() => setBankNotice(null), 4000);
      return;
    }
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
        if (resp.company && !targetCompany) {
          setTargetCompany(resp.company);
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

    if (!isExtensionValid()) {
      setBankNotice({
        type: 'info',
        message: 'Extension was reloaded. Please refresh the page to reconnect.',
      });
      setTimeout(() => setBankNotice(null), 4000);
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

  // Outreach Studio Handlers
  const handleExtractPageContextForOutreach = () => {
    const meta = jobMetadata || extractJobMetadata();
    let company = (meta.company && meta.company !== 'Company') ? meta.company : '';
    let role = (meta.title && meta.title !== 'Job Application') ? meta.title : '';

    if (!company || !role) {
      const docTitle = document.title || '';
      const cleanDocTitle = docTitle.replace(/\s*[-–—|]\s*(LinkedIn|Twitter|X|GitHub|Gmail)$/i, '').trim();
      if (!role && cleanDocTitle) {
        const atMatch = cleanDocTitle.match(/^(?:.*?\s*[-–—|]\s*)?(.*?)\s+(?:at|@)\s+([^–—|]+)/i);
        if (atMatch) {
          if (!role) role = atMatch[1].trim();
          if (!company) company = atMatch[2].trim();
        } else if (!company && cleanDocTitle.includes(' - ')) {
          const parts = cleanDocTitle.split(' - ');
          if (parts.length >= 2) {
            role = parts[1].trim();
          }
        }
      }
    }

    if (company) setOutreachTargetCompany(company);
    if (role) setOutreachTargetRole(role);

    setBankNotice({
      type: 'success',
      message: company || role 
        ? `Context extracted: ${[company, role].filter(Boolean).join(' • ')}`
        : 'Page inspected. You can enter company or role details below.',
    });
    setTimeout(() => setBankNotice(null), 3000);
  };

  const handleGenerateOutreach = async (instructionModifier?: string) => {
    if (!outreachDraft.trim()) {
      setBankNotice({
        type: 'info',
        message: 'Please write some raw thoughts or a draft to enhance.',
      });
      setTimeout(() => setBankNotice(null), 3000);
      return;
    }

    if (!isExtensionValid()) {
      setBankNotice({
        type: 'info',
        message: 'Extension was reloaded. Please refresh the page to reconnect.',
      });
      setTimeout(() => setBankNotice(null), 4000);
      return;
    }

    setIsGeneratingOutreach(true);
    setOutreachError(null);

    const currentStorage = storage || (await refreshStorage());
    const company = outreachTargetCompany.trim() || (jobMetadata?.company !== 'Company' ? jobMetadata?.company : '') || '';
    const role = outreachTargetRole.trim() || (jobMetadata?.title !== 'Job Application' ? jobMetadata?.title : '') || '';
    let contextNotes = outreachContextNotes.trim();
    if (instructionModifier) {
      contextNotes = contextNotes ? `${contextNotes} (Note: ${instructionModifier})` : instructionModifier;
    }

    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'GENERATE_OUTREACH',
        options: {
          rawDraft: outreachDraft,
          persona: outreachPersona,
          company,
          role,
          contextNotes,
        },
      });

      if (resp?.success && resp.result) {
        setOutreachResult(resp.result);
      } else if (resp?.error) {
        setOutreachError(resp.error);
      } else {
        // Fallback directly to prompt parsing in mock or isolated environment
        const systemPrompt = buildOutreachSystemPrompt(
          currentStorage.profile,
          outreachPersona,
          currentStorage.customPasteBank || []
        );
        const userPrompt = buildOutreachUserPrompt({
          rawDraft: outreachDraft,
          persona: outreachPersona,
          company,
          role,
          contextNotes,
          candidateProfile: currentStorage.profile,
          pasteBank: currentStorage.customPasteBank || [],
        });
        const rawAnswer = await generateAnswer(currentStorage.llmSettings, systemPrompt, userPrompt);
        const parsed = parseOutreachResponse(rawAnswer, outreachPersona);
        setOutreachResult(parsed);
      }
    } catch (err: any) {
      console.error('[QuickFiller] Outreach generation failed:', err);
      try {
        const systemPrompt = buildOutreachSystemPrompt(
          currentStorage.profile,
          outreachPersona,
          currentStorage.customPasteBank || []
        );
        const userPrompt = buildOutreachUserPrompt({
          rawDraft: outreachDraft,
          persona: outreachPersona,
          company,
          role,
          contextNotes,
          candidateProfile: currentStorage.profile,
          pasteBank: currentStorage.customPasteBank || [],
        });
        const rawAnswer = await generateAnswer(currentStorage.llmSettings, systemPrompt, userPrompt);
        const parsed = parseOutreachResponse(rawAnswer, outreachPersona);
        setOutreachResult(parsed);
      } catch (fallbackErr: any) {
        setOutreachError(fallbackErr.message || err.message || 'Failed to refine outreach message.');
      }
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const handleCopyOutreach = (variant: 'note' | 'pitch', text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setOutreachCopiedVariant(variant);
      setTimeout(() => setOutreachCopiedVariant(null), 2000);
    });
  };

  const handleInsertOutreach = (variant: 'note' | 'pitch', text: string) => {
    if (!text) return;
    handleInsertAtCursor(text, `outreach_${variant}`);
    setOutreachInsertedVariant(variant);
    setTimeout(() => setOutreachInsertedVariant(null), 2000);
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
      const isConnected = field.element && (field.element.isConnected ?? document.body.contains(field.element));
      if (isConnected) {
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

    let radioFilledCount = 0;
    radioGroups.forEach((group) => {
      const match = resolveRadioOption(
        group,
        currentStorage.wizardAnswers,
        currentStorage.questionBank
      );
      if (match && !match.isChecked) {
        const ok = setNativeRadioChecked(match.element);
        if (ok) radioFilledCount++;
      }
    });

    const totalFilled = filledCount + radioFilledCount;
    if (totalFilled > 0) {
      const parts: string[] = [];
      if (filledCount > 0) parts.push(`${filledCount} text field${filledCount > 1 ? 's' : ''}`);
      if (radioFilledCount > 0)
        parts.push(`${radioFilledCount} radio question${radioFilledCount > 1 ? 's' : ''}`);
      setAutofillBanner({
        type: 'success',
        message: `Successfully autofilled ${parts.join(' and ')}!`,
      });
    } else {
      setAutofillBanner({
        type: 'info',
        message: 'No matching profile values or radio answers found for detected fields on this page.',
      });
    }

    setTimeout(scanPage, 200);
  };

  const generateAnswerForField = (field: DetectedField, instructions?: string) => {
    if (!isExtensionValid()) {
      alert('QuickFiller extension was updated or reloaded. Please refresh the page to reconnect.');
      return;
    }

    setGenerating((prev) => ({ ...prev, [field.id]: true }));

    const cleanFormat = getCleanFormatHint(field.placeholder);

    try {
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
          if (chrome.runtime?.lastError) {
            alert('Extension context invalidated. Please refresh the page.');
            return;
          }
          if (res?.success && res.answer) {
            setAnswers((prev) => ({ ...prev, [field.id]: cleanAnswerOutput(res.answer) }));
          } else {
            alert(`Error generating answer: ${res?.error || 'Unknown error'}`);
          }
        }
      );
    } catch {
      setGenerating((prev) => ({ ...prev, [field.id]: false }));
      alert('Extension context invalidated. Please refresh the page.');
    }
  };

  const batchDraftAnswers = () => {
    const ungenerated = customQuestions.filter((q) => !answers[q.id]?.trim() && !generating[q.id]);
    if (ungenerated.length === 0) return;
    ungenerated.forEach((q) => generateAnswerForField(q));
  };

  const clampPosition = (x: number, y: number, width: number, height: number): { x: number; y: number } => {
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return {
      x: Math.round(Math.max(margin, Math.min(x, maxX))),
      y: Math.round(Math.max(margin, Math.min(y, maxY))),
    };
  };

  useEffect(() => {
    const handleResize = () => {
      setCustomPosition((prev) => {
        if (!prev || !drawerContainerRef.current) return prev;
        const rect = drawerContainerRef.current.getBoundingClientRect();
        const clamped = clampPosition(prev.x, prev.y, rect.width, rect.height);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          currentPosRef.current = clamped;
          try {
            sessionStorage.setItem('quickfiller_drawer_pos', JSON.stringify(clamped));
          } catch {}
          return clamped;
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
      return;
    }
    if (e.button !== 0) return;
    if (!drawerContainerRef.current) return;

    const rect = drawerContainerRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: rect.left,
      initPosY: rect.top,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !drawerContainerRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newX = dragStartRef.current.initPosX + deltaX;
    const newY = dragStartRef.current.initPosY + deltaY;

    const rect = drawerContainerRef.current.getBoundingClientRect();
    const clamped = clampPosition(newX, newY, rect.width, rect.height);
    currentPosRef.current = clamped;
    setCustomPosition(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      if (currentPosRef.current) {
        try {
          sessionStorage.setItem('quickfiller_drawer_pos', JSON.stringify(currentPosRef.current));
        } catch {}
      }
    }
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    setCustomPosition(null);
    currentPosRef.current = null;
    try {
      sessionStorage.removeItem('quickfiller_drawer_pos');
    } catch {}
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomPosition(null);
    currentPosRef.current = null;
    try {
      sessionStorage.removeItem('quickfiller_drawer_pos');
    } catch {}
  };

  const totalFields = standardFields.length + radioGroups.length + customQuestions.length;

  return (
    <div
      ref={drawerContainerRef}
      data-quickfiller-ui="true"
      style={
        isOpen && customPosition
          ? {
              position: 'fixed',
              left: `${customPosition.x}px`,
              top: `${customPosition.y}px`,
              bottom: 'auto',
              right: 'auto',
            }
          : undefined
      }
      className={`${
        isOpen && customPosition ? '' : 'fixed bottom-3 right-3 sm:bottom-5 sm:right-5'
      } z-[2147483647] font-sans text-slate-800 text-sm`}
    >
      {/* Auto-Tracked Toast when collapsed */}
      {!isOpen && autoTrackedToast && (
        <div className="mb-2 bg-slate-900 border border-emerald-500/40 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs animate-slide-up max-w-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <p className="font-bold text-emerald-300 text-[11px]">Application Tracked!</p>
              <p className="text-[10px] text-slate-300 truncate">
                {autoTrackedToast.title} • {autoTrackedToast.company}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                const current = (await getStorageData()).applications || [];
                const filtered = current.filter((a) => a.id !== autoTrackedToast.id);
                await updateStorageData({ applications: filtered });
                refreshStorage();
                setAutoTrackedToast(null);
              }}
              className="text-[10px] text-emerald-400 hover:text-emerald-200 underline font-semibold cursor-pointer"
            >
              Undo
            </button>
            <button
              onClick={() => setAutoTrackedToast(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            try {
              sessionStorage.setItem('quickfiller_drawer_open', 'true');
            } catch {}
            scanPage();
          }}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-2xl border border-slate-700 transition-all hover:scale-105 active:scale-95 animate-scale-in"
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
          className={`flex flex-col transition-all duration-200 ease-in-out bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-scale-in origin-bottom-right ${
            isExpanded
              ? 'w-[580px] sm:w-[680px] max-w-[calc(100vw-24px)] h-[640px] sm:h-[680px] max-h-[92vh]'
              : 'w-[380px] sm:w-[440px] max-w-[calc(100vw-24px)] h-[580px] sm:h-[620px] max-h-[90vh]'
          }`}
        >
          {/* Header (Drag Handle) */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleHeaderDoubleClick}
            className={`bg-slate-900 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between border-b border-slate-800 touch-none select-none transition-colors ${
              isDragging ? 'cursor-grabbing bg-slate-950' : 'cursor-grab'
            }`}
            title="Drag to move Copilot window (Double-click or click dock icon to reset position)"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300 flex-shrink-0" />
              <div className="p-1.5 bg-sky-500/15 border border-sky-500/30 rounded-lg flex-shrink-0 pointer-events-auto">
                <Zap className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0 flex-1 pointer-events-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm text-slate-100 flex-shrink-0">
                    QuickFiller Copilot
                  </h3>
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 flex-shrink-0 truncate max-w-[140px] sm:max-w-[240px]"
                    title={
                      storage?.llmSettings.provider === 'ollama'
                        ? storage.llmSettings.ollama.model || 'Ollama'
                        : storage?.llmSettings.provider || 'AI'
                    }
                  >
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

            <div className="flex items-center gap-1 flex-shrink-0">
              {customPosition !== null && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleResetPosition}
                  title="Dock to bottom-right corner"
                  className="p-1.5 text-sky-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setIsExpanded((prev) => {
                    const next = !prev;
                    try {
                      sessionStorage.setItem('quickfiller_drawer_expanded', next ? 'true' : 'false');
                    } catch {}
                    return next;
                  });
                }}
                title={isExpanded ? 'Collapse width' : 'Expand to wide view'}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={scanPage}
                title="Rescan form"
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setIsOpen(false);
                  try {
                    sessionStorage.setItem('quickfiller_drawer_open', 'false');
                  } catch {}
                }}
                title="Minimize"
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Auto-Tracked Toast when open */}
          {autoTrackedToast && (
            <div className="bg-emerald-950/95 border-b border-emerald-800/80 text-white px-3.5 py-2 flex items-center justify-between text-xs animate-slide-down">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-emerald-300">Tracked on submit:</span>{' '}
                  <span className="text-slate-200">{autoTrackedToast.title} ({autoTrackedToast.company})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleOpenJobTracker}
                  className="text-[11px] text-sky-300 hover:text-white underline font-semibold cursor-pointer"
                >
                  View Tracker
                </button>
                <button
                  onClick={async () => {
                    const current = (await getStorageData()).applications || [];
                    const filtered = current.filter((a) => a.id !== autoTrackedToast.id);
                    await updateStorageData({ applications: filtered });
                    refreshStorage();
                    setAutoTrackedToast(null);
                  }}
                  className="text-[11px] text-emerald-300 hover:text-white underline font-semibold cursor-pointer"
                >
                  Undo
                </button>
                <button
                  onClick={() => setAutoTrackedToast(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 pt-1.5 gap-1">
            {[
              { id: 'autofill', label: 'Autofill', count: totalFields > 0 ? totalFields : null },
              { id: 'coverLetter', label: 'Cover Letter', count: null },
              { id: 'outreach', label: 'Outreach', count: null },
              { id: 'bank', label: 'Paste Bank', count: (storage?.customPasteBank?.length || 0) > 0 ? storage!.customPasteBank.length : null },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    hasUserSelectedTab.current = true;
                    setActiveTab(tab.id as any);
                    if (tab.id === 'autofill') {
                      scanPage();
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium border-b-2 transition-all rounded-t-md active:scale-95 cursor-pointer ${
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
            {/* TAB: Cover Letter Generator */}
            {activeTab === 'coverLetter' && (
              <div className="space-y-3 animate-fade-in">
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
                      className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition"
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
                    <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-2.5 text-xs text-sky-900 animate-fade-in">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold block">Resolving Job Description...</span>
                        <span className="text-[10px] text-sky-700">Checking current page and previous link</span>
                      </div>
                    </div>
                  ) : coverLetterJD && !showJDInput ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 animate-slide-down">
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
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-slide-down">
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
                          className="text-[11px] bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg font-medium transition flex-shrink-0 flex items-center gap-1"
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
                              className="text-[11px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1 rounded-md font-medium transition"
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
                    className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
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
                  <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-3 animate-fade-in">
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
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex items-center gap-1"
                      >
                        {savedBankId === 'cover_letter_save' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex items-center gap-1"
                        >
                          {copiedId === 'cover_letter_copy' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                          className="text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 active:scale-95 px-3 py-1 rounded-md transition flex items-center gap-1"
                        >
                          {insertedId === 'cover_letter_btn' ? (
                            <>
                              <Check className="w-3 h-3 text-sky-400 animate-pop" />
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

            {/* TAB: Unified Autofill & Answers Copilot */}
            {activeTab === 'autofill' && (
              <div className="space-y-3 animate-fade-in">
                {/* 1-Click Autofill & Batch Actions Top Banner */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 bg-sky-50/80 border border-sky-100 rounded-xl gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-semibold text-xs text-sky-950">Application Copilot</h4>
                      {totalFields > 0 && (
                        <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded-full">
                          {totalFields} items
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-sky-700 mt-0.5">
                      1-click autofill standard fields & AI draft screening questions.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {customQuestions.length > 0 && (
                      <button
                        onClick={batchDraftAnswers}
                        disabled={customQuestions.every((q) => Boolean(answers[q.id]?.trim()))}
                        className="flex items-center gap-1 text-[11px] bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1.5 rounded-lg font-medium shadow-2xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Generate AI answers for all screening questions"
                      >
                        <Sparkles className="w-3 h-3 text-sky-500" />
                        <span>Draft Questions ({customQuestions.filter((q) => !answers[q.id]?.trim()).length})</span>
                      </button>
                    )}

                    <button
                      onClick={autofillAllStandard}
                      disabled={standardFields.length + radioGroups.length === 0}
                      className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Autofill ({standardFields.length + radioGroups.length})</span>
                    </button>
                  </div>
                </div>

                {autofillBanner && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border animate-slide-down ${
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

                {/* Segmented Filter Pills (shown when multiple categories exist) */}
                {[customQuestions.length > 0, standardFields.length > 0, radioGroups.length > 0].filter(Boolean).length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg text-[11px]">
                    <button
                      onClick={() => setAutofillFilter('all')}
                      className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
                        autofillFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({totalFields})
                    </button>
                    {customQuestions.length > 0 && (
                      <button
                        onClick={() => setAutofillFilter('questions')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
                          autofillFilter === 'questions'
                            ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Questions ({customQuestions.length})
                      </button>
                    )}
                    {standardFields.length > 0 && (
                      <button
                        onClick={() => setAutofillFilter('standard')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
                          autofillFilter === 'standard'
                            ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Standard ({standardFields.length})
                      </button>
                    )}
                    {radioGroups.length > 0 && (
                      <button
                        onClick={() => setAutofillFilter('radios')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
                          autofillFilter === 'radios'
                            ? 'bg-white text-indigo-800 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Radios ({radioGroups.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Empty State when 0 fields of any kind */}
                {totalFields === 0 && (
                  <div className="text-center py-12 text-slate-400 space-y-2 bg-white rounded-xl border border-slate-200/80 p-6">
                    <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-xs sm:text-sm text-slate-700">
                      No form fields or questions detected
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Navigate to a job application form (Workday, Greenhouse, Lever, Google Forms, etc.) or click Rescan above.
                    </p>
                  </div>
                )}

                {/* Section 1: Screening Questions */}
                {(autofillFilter === 'all' || autofillFilter === 'questions') && customQuestions.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Screening Questions ({customQuestions.length})
                        </span>
                      </div>
                      {customQuestions.some((q) => !answers[q.id]?.trim()) && (
                        <button
                          onClick={batchDraftAnswers}
                          className="text-[10px] text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                        >
                          Draft all &rarr;
                        </button>
                      )}
                    </div>

                    {customQuestions.map((field) => {
                      const answer = answers[field.id] || field.value || '';
                      const isGen = generating[field.id] || false;
                      const formatHint = getCleanFormatHint(field.placeholder);

                      return (
                        <div
                          key={field.id}
                          className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-2.5 min-w-0 overflow-hidden hover:border-slate-300 transition"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <label className="text-xs font-semibold text-slate-800 leading-snug break-words min-w-0 flex-1">
                                {field.label}
                              </label>
                              <button
                                disabled={isGen}
                                onClick={() => generateAnswerForField(field)}
                                className="flex items-center gap-1 text-[11px] bg-sky-50 text-sky-700 hover:bg-sky-100 active:scale-95 font-medium px-2 py-1 rounded-md transition disabled:opacity-50 flex-shrink-0 cursor-pointer"
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
                                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 active:scale-95 whitespace-nowrap underline cursor-pointer"
                                >
                                  Tailor with JD &rarr;
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Answer input or textarea */}
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
                                  className="text-[10px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition font-medium cursor-pointer"
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
                                  className="text-[10px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition font-medium cursor-pointer"
                                >
                                  Add Project
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleSaveAnswerToPasteBank(field.label, answer, field.id)}
                                  title="Save answer to Paste Bank for 1-click re-use"
                                  className="flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 active:scale-95 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-md transition font-medium cursor-pointer"
                                >
                                  {savedBankId === field.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-sky-600 animate-pop" />
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
                                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition font-medium cursor-pointer"
                                >
                                  {copiedId === field.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                                  className="flex items-center gap-1 text-[11px] bg-slate-900 hover:bg-slate-800 active:scale-95 text-white px-3 py-1 rounded-md font-medium transition cursor-pointer"
                                >
                                  {insertedId === field.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-sky-400 animate-pop" />
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
                    })}
                  </div>
                )}

                {/* Section 2: Standard Form Fields */}
                {(autofillFilter === 'all' || autofillFilter === 'standard') && standardFields.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 pt-1">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Standard Fields ({standardFields.length})
                        </span>
                      </div>
                    </div>

                    {standardFields.map((field) => {
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
                              className="text-[11px] font-medium text-slate-700 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1 rounded-md transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                            >
                              {insertedId === field.id ? (
                                <span className="text-emerald-600 flex items-center gap-1 animate-pop">
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
                              <button
                                type="button"
                                onClick={() => handleOpenOptionsPage('profile')}
                                className="text-[10px] text-amber-600 hover:text-amber-800 hover:underline italic break-words min-w-0 text-left cursor-pointer"
                              >
                                Not in profile — add in Options &rarr;
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Section 3: Radio Questions Section */}
                {(autofillFilter === 'all' || autofillFilter === 'radios') && radioGroups.length > 0 && (
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Radio Questions ({radioGroups.length})
                        </span>
                      </div>
                    </div>

                    {radioGroups.map((group) => {
                      const matchedOpt = resolveRadioOption(
                        group,
                        storage?.wizardAnswers,
                        storage?.questionBank
                      );

                      return (
                        <div
                          key={group.id}
                          className="p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-2 hover:border-slate-300 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-xs text-slate-900 break-words flex-1 min-w-0">
                                  {group.label}
                                </span>
                                <span className="text-[9px] font-medium text-purple-600 bg-purple-50 border border-purple-200/60 px-1.5 py-0.2 rounded capitalize flex-shrink-0">
                                  {group.category.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            {matchedOpt && (
                              <button
                                onClick={() => {
                                  setNativeRadioChecked(matchedOpt.element);
                                  setInsertedId(group.id);
                                  setTimeout(() => setInsertedId(null), 2000);
                                  setTimeout(scanPage, 150);
                                }}
                                className="text-[11px] font-medium text-slate-700 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                              >
                                {insertedId === group.id || matchedOpt.isChecked ? (
                                  <span className="text-emerald-600 flex items-center gap-1 animate-pop">
                                    <Check className="w-3 h-3" /> Selected
                                  </span>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3 text-slate-500" />
                                    <span>Select</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Options Pills */}
                          <div className="flex flex-wrap gap-1">
                            {group.options.map((opt) => {
                              const isTarget = matchedOpt?.id === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setNativeRadioChecked(opt.element);
                                    setTimeout(scanPage, 150);
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer flex items-center gap-1 ${
                                    opt.isChecked
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                                      : isTarget
                                      ? 'bg-sky-50 border-sky-300 text-sky-800 font-medium'
                                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {opt.isChecked ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : isTarget ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                  ) : null}
                                  <span className="truncate max-w-[150px]">{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Outreach Studio */}
            {activeTab === 'outreach' && (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 border border-indigo-200/60 text-indigo-600 rounded-lg">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-slate-800">Outreach Studio</h4>
                        <p className="text-[10px] text-slate-500">Refine raw thoughts into high-impact messages</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractPageContextForOutreach}
                      title="Extract company or person from current page"
                      className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>Extract Context</span>
                    </button>
                  </div>

                  {/* Target Persona Switcher */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Target Audience
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-lg border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setOutreachPersona('recruiter')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                          outreachPersona === 'recruiter'
                            ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Recruiter / HR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutreachPersona('technical')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                          outreachPersona === 'technical'
                            ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Engineering Lead</span>
                      </button>
                    </div>
                  </div>

                  {/* Raw Draft Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Your Raw Thoughts / Draft
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {outreachDraft.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={outreachDraft}
                      onChange={(e) => setOutreachDraft(e.target.value)}
                      placeholder={
                        outreachPersona === 'recruiter'
                          ? "e.g., noticed your team has an opening for a frontend engineer, applied on your portal, wanted to say hi and share my portfolio..."
                          : "e.g., hey saw your team uses Go and Kafka for real-time streaming, saw the backend opening, wanted to ask about your event-driven setup..."
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-hidden transition resize-none placeholder:text-slate-400"
                    />
                  </div>

                  {/* Target Company & Role */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Company / Org
                      </label>
                      <input
                        type="text"
                        value={outreachTargetCompany}
                        onChange={(e) => setOutreachTargetCompany(e.target.value)}
                        placeholder="e.g. Stripe, Acme"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-hidden transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Role / Context
                      </label>
                      <input
                        type="text"
                        value={outreachTargetRole}
                        onChange={(e) => setOutreachTargetRole(e.target.value)}
                        placeholder="e.g. Senior Backend"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-hidden transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Additional Context Notes */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Optional Hook / Context
                    </label>
                    <input
                      type="text"
                      value={outreachContextNotes}
                      onChange={(e) => setOutreachContextNotes(e.target.value)}
                      placeholder="e.g. Spoke at ReactConf, loved their recent tech blog"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-hidden transition placeholder:text-slate-400"
                    />
                  </div>

                  {/* Generate Button */}
                  <button
                    type="button"
                    onClick={() => handleGenerateOutreach()}
                    disabled={isGeneratingOutreach || !outreachDraft.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-lg font-medium text-xs shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isGeneratingOutreach ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Refining Message...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Refine Message</span>
                      </>
                    )}
                  </button>

                  {/* Error Alert */}
                  {outreachError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[11px]">{outreachError}</p>
                        <button
                          type="button"
                          onClick={() => handleOpenOptionsPage('settings')}
                          className="mt-1 text-[10px] text-rose-800 underline font-semibold cursor-pointer"
                        >
                          Check QuickFiller Settings & LLM API Keys
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Results: Dual Variants */}
                  {outreachResult && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/80">
                      {/* Variant A: Connection Note */}
                      <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-800">
                              Variant A: Connection Note
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium border ${
                                outreachResult.connectionNoteCharCount <= 300
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                              title={
                                outreachResult.connectionNoteCharCount <= 300
                                  ? 'Within LinkedIn 300 character limit'
                                  : 'Exceeds standard 300 character limit'
                              }
                            >
                              {outreachResult.connectionNoteCharCount} / 300 chars
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyOutreach('note', outreachResult.connectionNote)}
                              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded border border-slate-200 transition active:scale-95 cursor-pointer"
                              title="Copy to clipboard"
                            >
                              {outreachCopiedVariant === 'note' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
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
                              onClick={() => handleInsertOutreach('note', outreachResult.connectionNote)}
                              className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium rounded border border-indigo-200/60 transition active:scale-95 cursor-pointer"
                              title="Insert into active input on the page"
                            >
                              {outreachInsertedVariant === 'note' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Inserted!</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-3 h-3 text-indigo-600" />
                                  <span>Insert</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                          {outreachResult.connectionNote}
                        </div>
                      </div>

                      {/* Variant B: High-Impact Pitch */}
                      <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-800">
                              Variant B: High-Impact Pitch
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-200/70 text-slate-600 border border-slate-300/60">
                              {outreachResult.fullPitchWordCount} words
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyOutreach('pitch', outreachResult.fullPitch)}
                              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded border border-slate-200 transition active:scale-95 cursor-pointer"
                              title="Copy to clipboard"
                            >
                              {outreachCopiedVariant === 'pitch' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
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
                              onClick={() => handleInsertOutreach('pitch', outreachResult.fullPitch)}
                              className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium rounded border border-indigo-200/60 transition active:scale-95 cursor-pointer"
                              title="Insert into active input on the page"
                            >
                              {outreachInsertedVariant === 'pitch' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Inserted!</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-3 h-3 text-indigo-600" />
                                  <span>Insert</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text max-h-[220px] overflow-y-auto">
                          {outreachResult.fullPitch}
                        </div>
                      </div>

                      {/* Quick Tone Iteration Modifiers */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">Quick Refine:</span>
                        <button
                          type="button"
                          onClick={() => handleGenerateOutreach('Make it even more concise and direct.')}
                          disabled={isGeneratingOutreach}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                          Shorter
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateOutreach('Highlight deeper technical architecture and tech stack specifics.')}
                          disabled={isGeneratingOutreach}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                          More Technical
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateOutreach('Make the tone slightly more conversational and peer-friendly.')}
                          disabled={isGeneratingOutreach}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                          More Casual
                        </button>
                      </div>
                    </div>
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
                { label: 'Phone Number', value: cleanPhoneNumber(storage.profile.personal.phone || '') },
                { label: 'Phone Extension', value: storage.profile.personal.phoneExtension || extractPhoneExtension(storage.profile.personal.phone || '') },
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
                <div className="space-y-3 text-xs animate-fade-in">
                  {/* Top Bar with Add Snippet Button */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      1-click copy &amp; insert for reusable values.
                    </p>
                    <button
                      onClick={() => setIsAddingSnippet(!isAddingSnippet)}
                      className="flex items-center gap-1 text-[11px] bg-sky-50 text-sky-700 hover:bg-sky-100 active:scale-95 font-medium px-2.5 py-1 rounded-md transition flex-shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      {isAddingSnippet ? 'Cancel' : 'Add Snippet'}
                    </button>
                  </div>

                  {/* Inline Add Snippet Drawer Form */}
                  {isAddingSnippet && (
                    <div className="p-3 bg-white border border-sky-200 rounded-xl shadow-xs space-y-2 animate-slide-down">
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
                          className="text-[11px] text-slate-600 hover:text-slate-900 active:scale-95 px-2.5 py-1 rounded-md transition font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSnippet}
                          disabled={!newSnippetLabel.trim() || !newSnippetValue.trim()}
                          className="text-[11px] bg-sky-600 hover:bg-sky-700 active:scale-95 text-white px-3 py-1 rounded-md transition font-medium disabled:opacity-50"
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
                      className={`p-2 rounded-lg text-xs flex items-center gap-2 border animate-slide-down ${
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
                              className="flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 active:scale-95 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-1 rounded-md transition"
                            >
                              {insertedId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                              className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                              className="text-slate-300 hover:text-rose-600 active:scale-90 p-1 rounded transition"
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
                              className="flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 active:scale-95 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-1 rounded-md transition"
                            >
                              {insertedId === `std_${idx}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                              className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
                            >
                              {copiedId === `std_${idx}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                                className="flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 active:scale-95 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md transition font-medium"
                              >
                                {insertedId === q.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition font-medium"
                              >
                                {copiedId === q.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                                  className="flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 active:scale-95 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md transition font-medium"
                                >
                                  {insertedId === proj.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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
                                  className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 active:scale-95 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition font-medium"
                                >
                                  {copiedId === proj.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 animate-pop" />
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

          {/* Footer with Job Tracker & Options Link */}
          <div className="px-3.5 py-2.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {/* Job Tracker Navigation Button */}
              <button
                onClick={handleOpenJobTracker}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs"
                title="Open your Job Tracker dashboard in options"
              >
                <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                <span>Job Tracker</span>
                {(storage?.applications?.length || 0) > 0 && (
                  <span className="bg-sky-200/80 text-sky-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {storage!.applications.length}
                  </span>
                )}
              </button>

              {/* Track Current Job Button */}
              {storage?.jobTrackerEnabled !== false && (
                <div className="relative">
                  {!currentTrackedApp ? (
                    <button
                      onClick={handleTrackCurrentJob}
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      title="Save this job application to your local tracker"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-slate-500" />
                      <span>Track Job</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setShowTrackerMenu(!showTrackerMenu)}
                        className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs ${
                          justTrackedAnim
                            ? 'bg-emerald-500 text-white animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title="Application is tracked! Click to update status or remove"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="max-w-[80px] truncate">{currentTrackedApp.status}</span>
                        <ChevronUp className="w-3 h-3 text-emerald-600/70" />
                      </button>

                      {showTrackerMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowTrackerMenu(false)}
                          />
                          <div className="absolute left-0 bottom-full mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 animate-scale-in origin-bottom-left text-xs">
                            <button
                              onClick={() => {
                                setShowTrackerMenu(false);
                                handleOpenJobTracker();
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-[11px] flex items-center justify-between text-sky-400 hover:bg-slate-700/70 transition cursor-pointer font-medium border-b border-slate-700/80"
                            >
                              <span className="flex items-center gap-1.5">
                                <Briefcase className="w-3 h-3" />
                                Open in Job Tracker
                              </span>
                              <ExternalLink className="w-3 h-3" />
                            </button>

                            {currentTrackedApp.portalUrl && isSafeWebUrl(currentTrackedApp.portalUrl) && (
                              <a
                                href={sanitizeWebUrl(currentTrackedApp.portalUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowTrackerMenu(false)}
                                className="w-full text-left px-2.5 py-1.5 text-[11px] flex items-center justify-between text-emerald-400 hover:bg-slate-700/70 transition cursor-pointer font-medium border-b border-slate-700/80"
                                title="Open company candidate tracking portal"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ExternalLink className="w-3 h-3 text-emerald-400" />
                                  Candidate Portal
                                </span>
                                <span className="text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700/50">Visit</span>
                              </a>
                            )}

                            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Update Status
                            </div>
                            {(['Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected'] as ApplicationStatus[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleUpdateTrackedStatus(st)}
                                className={`w-full text-left px-2.5 py-1.5 text-[11px] flex items-center justify-between hover:bg-slate-700/70 transition cursor-pointer ${
                                  currentTrackedApp.status === st ? 'text-sky-400 font-semibold' : 'text-slate-300'
                                }`}
                              >
                                <span>{st}</span>
                                {currentTrackedApp.status === st && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                            <div className="border-t border-slate-700/80 my-1" />
                            <button
                              onClick={handleRemoveTrackedJob}
                              className="w-full text-left px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-900/30 transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove from Tracker
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => handleOpenOptionsPage('profile')}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium text-[11px] cursor-pointer"
            >
              <span>Options</span> <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
