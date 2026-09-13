import { JobMetadata, extractJobMetadata } from './scanner';
import { JobApplication } from '../types/applications';
import { getStorageData, updateStorageData } from './storage';

const SESSION_STORAGE_KEY = 'quickfiller_pending_submission';
const STAGE_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

interface StagedJob {
  company: string;
  title: string;
  url: string;
  timestamp: number;
}

export const CONFIRMATION_URL_REGEX =
  /(\/confirmation|\/thank-you|\/thanks|\/applied|\/submitted|application_submitted|\/success|applied=true|status=success|submitted=1)/i;

export const SUCCESS_TEXT_REGEX =
  /((application|form|submission) (has been )?(successfully )?submitted|(application|form|submission) submitted successfully|thank you for (your application|applying)|your (application|form) (has been|was) received|(application|form) (received|complete)|we('ve| have) received your application|we appreciate your interest in|submission successful|successfully submitted)/i;

/**
 * Saves or updates the currently viewed job candidate into session storage.
 */
export function stageCurrentJobMetadata(metadata: JobMetadata | null): void {
  if (!metadata) return;
  const title = (metadata.title || '').trim() || 'Job Application';
  const company = (metadata.company || '').trim() || 'Company';
  try {
    const staged: StagedJob = {
      company,
      title,
      url: window.location.href,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(staged));
  } catch {
    // Ignore storage quota or cross-origin restrictions
  }
}

/**
 * Retrieves staged job from session storage if valid and unexpired.
 */
export function getStagedJobMetadata(): StagedJob | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: StagedJob = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > STAGE_EXPIRATION_MS) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears the staged submission from session storage.
 */
export function clearStagedJobMetadata(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Tests if an element represents an application submission trigger button.
 */
export function isSubmitTriggerElement(elem: HTMLElement | null): boolean {
  if (!elem) return false;

  // 1. Direct submit input or button
  if (elem.tagName === 'INPUT' && (elem as HTMLInputElement).type === 'submit') {
    return true;
  }
  if (elem.tagName === 'BUTTON' && (elem as HTMLButtonElement).type === 'submit') {
    return true;
  }

  // 2. ATS specific attributes (Workday, Greenhouse, Ashby, Lever)
  if (
    elem.getAttribute('data-automation-id') === 'submit-button' ||
    elem.getAttribute('data-automation-id') === 'bottom-submit-button' ||
    elem.getAttribute('data-qa') === 'submit-application' ||
    elem.id.toLowerCase().includes('submit') ||
    elem.className.toLowerCase().includes('submit-btn') ||
    elem.className.toLowerCase().includes('submit-application')
  ) {
    return true;
  }

  // 3. Button / link text content inspection
  const text = (elem.textContent || '').trim();
  if (
    /^(submit(\s*(application|form))?|apply(\s*now)?|complete\s*application|send\s*application)$/i.test(
      text
    )
  ) {
    return true;
  }

  // Check parent button if user clicked an inner span/icon
  const parentBtn = elem.closest('button, [role="button"], a');
  if (parentBtn && parentBtn !== elem) {
    return isSubmitTriggerElement(parentBtn as HTMLElement);
  }

  return false;
}

/**
 * Checks if the current page URL or DOM indicates a successful application submission.
 */
export function isSubmissionSuccessState(): boolean {
  // 1. URL pattern check
  if (CONFIRMATION_URL_REGEX.test(window.location.href)) {
    return true;
  }

  // 2. DOM text check on prominent headers, alerts, and success containers
  const prominentElements = document.querySelectorAll(
    'h1, h2, h3, h4, h5, [role="alert"], [data-automation-id*="success"], [data-automation-id*="confirmation"], [id*="submitted"], [id*="success"], [class*="submitted"], [class*="success"], .confirmation, .success'
  );

  for (const el of Array.from(prominentElements)) {
    const content = (el.textContent || '').trim();
    if (content && SUCCESS_TEXT_REGEX.test(content)) {
      return true;
    }
  }

  return false;
}

export interface SubmissionWatcherOptions {
  onAutoTracked: (app: JobApplication) => void;
}

/**
 * Initializes listeners to detect form submissions and success confirmation.
 * Returns a teardown function.
 */
export function initSubmissionWatcher(options: SubmissionWatcherOptions): () => void {
  let isListening = true;
  let submitAttemptTimestamp = 0;

  // Helper to commit application
  const commitApplicationIfPending = async () => {
    let staged = getStagedJobMetadata();

    // Fallback: If no staged metadata exists, extract fresh from page
    if (!staged) {
      const fresh = extractJobMetadata();
      staged = {
        company: fresh.company || 'Company',
        title: fresh.title || 'Job Application',
        url: window.location.href,
        timestamp: Date.now(),
      };
    }

    const storage = await getStorageData();
    if (storage.jobTrackerEnabled === false || storage.autoTrackOnSubmit === false) {
      return;
    }

    const currentApps = storage.applications || [];
    const normalizedStagedUrl = staged.url.split('?')[0].replace(/\/$/, '').toLowerCase();

    // Prevent duplicate entries
    const isAlreadyTracked = currentApps.some((a) => {
      const normAppUrl = a.url.split('?')[0].replace(/\/$/, '').toLowerCase();
      // Only match URL if not a generic local file or test form
      if (normAppUrl === normalizedStagedUrl && !normalizedStagedUrl.includes('test-form.html')) {
        return true;
      }
      if (
        a.company.toLowerCase() === staged!.company.toLowerCase() &&
        a.title.toLowerCase() === staged!.title.toLowerCase()
      ) {
        // Debounce: allow re-tracking if older than 2 minutes
        const diffMs = Date.now() - new Date(a.appliedDate || 0).getTime();
        return diffMs < 2 * 60 * 1000;
      }
      return false;
    });

    if (isAlreadyTracked) {
      clearStagedJobMetadata();
      return;
    }

    const newApp: JobApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company: staged.company,
      title: staged.title,
      url: staged.url,
      appliedDate: new Date().toISOString(),
      status: 'Applied',
      notes: 'Auto-tracked on application submission',
      updatedAt: new Date().toISOString(),
    };

    const updatedApps = [newApp, ...currentApps];
    await updateStorageData({ applications: updatedApps });
    clearStagedJobMetadata();

    options.onAutoTracked(newApp);
  };

  // 1. Check if user landed on a confirmation page immediately on load (post-redirect)
  if (isSubmissionSuccessState()) {
    commitApplicationIfPending();
  }

  // 2. Click listener for submit buttons
  const handleClick = (e: MouseEvent) => {
    if (!isListening) return;
    const target = e.target as HTMLElement | null;
    if (isSubmitTriggerElement(target)) {
      submitAttemptTimestamp = Date.now();
      const meta = extractJobMetadata();
      stageCurrentJobMetadata(meta);

      setTimeout(() => {
        if (isSubmissionSuccessState()) {
          commitApplicationIfPending();
        }
      }, 100);
      setTimeout(() => {
        if (isSubmissionSuccessState()) {
          commitApplicationIfPending();
        }
      }, 400);
    }
  };

  // 3. Form submit event listener
  const handleSubmit = (e: SubmitEvent) => {
    if (!isListening) return;
    submitAttemptTimestamp = Date.now();

    const meta = extractJobMetadata();
    stageCurrentJobMetadata(meta);

    setTimeout(() => {
      if (isSubmissionSuccessState()) {
        commitApplicationIfPending();
      }
    }, 100);
    setTimeout(() => {
      if (isSubmissionSuccessState()) {
        commitApplicationIfPending();
      }
    }, 400);
  };

  // 4. DOM MutationObserver to catch in-page SPA success states
  const observer = new MutationObserver(() => {
    if (!isListening) return;

    // Check if success text appeared
    if (isSubmissionSuccessState()) {
      commitApplicationIfPending();
    }
  });

  // 5. URL change detection (SPA navigation)
  let lastUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    if (!isListening) return;
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isSubmissionSuccessState()) {
        commitApplicationIfPending();
      }
    }
  }, 1000);

  document.addEventListener('click', handleClick, true);
  document.addEventListener('submit', handleSubmit, true);
  window.addEventListener('popstate', () => {
    if (isSubmissionSuccessState()) commitApplicationIfPending();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Teardown
  return () => {
    isListening = false;
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('submit', handleSubmit, true);
    clearInterval(urlCheckInterval);
    observer.disconnect();
  };
}
