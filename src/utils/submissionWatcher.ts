import { JobMetadata, extractJobMetadata, isElementVisible, querySelectorAllDeep } from './scanner';
import { JobApplication } from '../types/applications';
import { getStorageData, updateStorageData } from './storage';

const SESSION_STORAGE_KEY = 'quickfiller_pending_submission';
const STAGE_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
const SUBMIT_WINDOW_MS = 30 * 1000; // 30 seconds

export interface StagedJob {
  company: string;
  title: string;
  url: string;
  timestamp: number;
  submitted: boolean;
}

export const CONFIRMATION_URL_REGEX =
  /(\/confirmation|\/thank-you|\/thanks|\/applied|\/submitted|application_submitted|\/success|applied=true|status=success|submitted=1)/i;

export const SUCCESS_TEXT_REGEX =
  /((application|form|submission) (has been )?(successfully )?submitted|(application|form|submission) submitted successfully|thank you for (your application|applying)|your (application|form) (has been|was) received|(application|form) (received|complete)|we('ve| have) received your application|we appreciate your interest in|submission successful|successfully submitted)/i;

/**
 * Saves or updates the currently viewed job candidate into session storage.
 */
export function stageCurrentJobMetadata(
  metadata: JobMetadata | null,
  submitted: boolean = true
): void {
  if (!metadata) return;
  const title = (metadata.title || '').trim() || 'Job Application';
  const company = (metadata.company || '').trim() || 'Company';
  try {
    const staged: StagedJob = {
      company,
      title,
      url: window.location.href,
      timestamp: Date.now(),
      submitted,
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(staged));
  } catch {
    // Ignore storage quota or cross-origin restrictions
  }
}

/**
 * Retrieves staged job from session storage if valid and unexpired.
 * If requireSubmitted is true, only returns if the job was explicitly submitted.
 */
export function getStagedJobMetadata(requireSubmitted: boolean = false): StagedJob | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: StagedJob = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > STAGE_EXPIRATION_MS) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    if (requireSubmitted && !parsed.submitted) {
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

  // 2. ATS / Web Component specific attributes (Workday, Greenhouse, Ashby, Lever, Darwinbox)
  const tagName = elem.tagName.toLowerCase();
  const automationId = (elem.getAttribute('data-automation-id') || '').toLowerCase();
  const dataQa = (elem.getAttribute('data-qa') || '').toLowerCase();
  const id = (elem.id || '').toLowerCase();
  const className = (typeof elem.className === 'string' ? elem.className : '').toLowerCase();
  const role = (elem.getAttribute('role') || '').toLowerCase();
  const type = (elem.getAttribute('type') || '').toLowerCase();

  if (
    type === 'submit' ||
    automationId.includes('submit') ||
    dataQa.includes('submit') ||
    id.includes('submit') ||
    className.includes('submit-btn') ||
    className.includes('submit-application') ||
    className.includes('dbx-btn-submit')
  ) {
    return true;
  }

  // 3. Web Component buttons like <dbx-ds-button>
  if (tagName.includes('button') || tagName.startsWith('dbx-ds-') || role === 'button') {
    const hostLabel = elem.getAttribute('label') || elem.getAttribute('text') || elem.getAttribute('value') || '';
    if (
      /^(submit(\s*(application|form))?|apply(\s*now)?|complete\s*application|send\s*application)$/i.test(
        hostLabel.trim()
      )
    ) {
      return true;
    }
  }

  // 4. Button / link text content inspection
  const text = (elem.textContent || '').trim();
  if (
    /^(submit(\s*(application|form))?|apply(\s*now)?|complete\s*application|send\s*application)$/i.test(
      text
    )
  ) {
    return true;
  }

  // 5. Check parent button if user clicked an inner span/icon
  const parentBtn = elem.closest('button, [role="button"], a, dbx-ds-button, [class*="submit"]');
  if (parentBtn && parentBtn !== elem) {
    return isSubmitTriggerElement(parentBtn as HTMLElement);
  }

  // 6. Check shadow root host if inside shadow DOM
  try {
    const root = elem.getRootNode();
    if (root && 'host' in root) {
      const host = (root as ShadowRoot).host as HTMLElement;
      if (host && host !== elem) {
        return isSubmitTriggerElement(host);
      }
    }
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Checks if the current URL is an ATS confirmation URL.
 */
export function isConfirmationUrl(url: string = window.location.href): boolean {
  return CONFIRMATION_URL_REGEX.test(url);
}

/**
 * Checks if the DOM currently contains a VISIBLE submission success message.
 * Strictly ignores hidden elements (e.g. display: none or hidden parent modals).
 */
export function hasVisibleSuccessMessage(): boolean {
  const prominentElements = querySelectorAllDeep<HTMLElement>(
    'h1, h2, h3, h4, h5, [role="alert"], [data-automation-id*="success"], [data-automation-id*="confirmation"], [id*="submitted"], [id*="success"], [class*="submitted"], [class*="success"], .confirmation, .success',
    document
  );

  for (const el of prominentElements) {
    if (!isElementVisible(el)) {
      continue;
    }
    const content = (el.textContent || '').trim();
    if (content && SUCCESS_TEXT_REGEX.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the DOM currently contains an active, unsubmitted application form.
 * If visible input fields exist, the user is looking at the application form, NOT a confirmation page.
 */
export function hasActiveFormFields(): boolean {
  try {
    const inputs = querySelectorAllDeep<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea',
      document
    );
    let visibleCount = 0;
    for (const input of inputs) {
      if (isElementVisible(input)) {
        visibleCount++;
        if (visibleCount >= 2) return true;
      }
    }
    return visibleCount > 0;
  } catch {
    return false;
  }
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

  // Helper to commit application to local storage
  const commitApplicationIfPending = async (forceCommit = false) => {
    // Safety check 1: must either be a redirect confirmation URL OR a recent submit attempt
    const recentSubmit =
      submitAttemptTimestamp > 0 && Date.now() - submitAttemptTimestamp < SUBMIT_WINDOW_MS;

    if (!recentSubmit && !forceCommit) {
      return;
    }

    // Safety check 2: Never commit if the page is currently an active application form without a visible success message
    if (hasActiveFormFields() && !hasVisibleSuccessMessage()) {
      return;
    }

    const staged: StagedJob = getStagedJobMetadata() || {
      company: extractJobMetadata().company || 'Company',
      title: extractJobMetadata().title || 'Job Application',
      url: window.location.href,
      timestamp: Date.now(),
      submitted: true,
    };

    const storage = await getStorageData();
    if (storage.jobTrackerEnabled === false || storage.autoTrackOnSubmit === false) {
      return;
    }

    const currentApps = storage.applications || [];
    const normalizedStagedUrl = staged.url.split('?')[0].replace(/\/$/, '').toLowerCase();

    // Prevent duplicate entries (exclude local test files so developers can test repeatedly)
    const isTestFile =
      normalizedStagedUrl.includes('test-form.html') ||
      normalizedStagedUrl.includes('test-app') ||
      normalizedStagedUrl.includes('darwinbox-test');

    const isAlreadyTracked = currentApps.some((a) => {
      if (isTestFile) return false;
      const normAppUrl = a.url.split('?')[0].replace(/\/$/, '').toLowerCase();
      if (normAppUrl === normalizedStagedUrl) {
        return true;
      }
      if (
        a.company.toLowerCase() === staged!.company.toLowerCase() &&
        a.title.toLowerCase() === staged!.title.toLowerCase()
      ) {
        const diffMs = Date.now() - new Date(a.appliedDate || 0).getTime();
        return diffMs < 2 * 60 * 1000;
      }
      return false;
    });

    if (isAlreadyTracked) {
      clearStagedJobMetadata();
      submitAttemptTimestamp = 0;
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
    submitAttemptTimestamp = 0;

    options.onAutoTracked(newApp);
  };

  // 1. Check if user landed on a confirmation page via redirect (must have an explicitly submitted staged job)
  if (isConfirmationUrl()) {
    const staged = getStagedJobMetadata(true);
    if (staged && (!hasActiveFormFields() || hasVisibleSuccessMessage())) {
      commitApplicationIfPending(true);
    }
  }

  const handleUserSubmitIntent = () => {
    submitAttemptTimestamp = Date.now();
    const meta = extractJobMetadata();
    stageCurrentJobMetadata(meta, true);

    // Staggered check intervals to capture SPA DOM updates
    [100, 300, 700, 1500].forEach((delay) => {
      setTimeout(() => {
        if (!isListening) return;
        if (hasVisibleSuccessMessage() || (isConfirmationUrl() && !hasActiveFormFields())) {
          commitApplicationIfPending();
        }
      }, delay);
    });
  };

  // 2. Click listener for submit buttons
  const handleClick = (e: MouseEvent) => {
    if (!isListening) return;
    const path = (e.composedPath && e.composedPath()) || [e.target];
    for (const node of path) {
      if (node instanceof HTMLElement && isSubmitTriggerElement(node)) {
        handleUserSubmitIntent();
        break;
      }
    }
  };

  // 3. Form submit event listener
  const handleSubmit = (e: SubmitEvent) => {
    if (!isListening) return;
    handleUserSubmitIntent();
  };

  // 4. DOM MutationObserver to catch in-page SPA success states
  const observer = new MutationObserver(() => {
    if (!isListening) return;
    const recentSubmit =
      submitAttemptTimestamp > 0 && Date.now() - submitAttemptTimestamp < SUBMIT_WINDOW_MS;

    if (recentSubmit && (hasVisibleSuccessMessage() || (isConfirmationUrl() && !hasActiveFormFields()))) {
      commitApplicationIfPending();
    }
  });

  // 5. URL change detection (SPA navigation)
  let lastUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    if (!isListening) return;
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isConfirmationUrl()) {
        const recentSubmit =
          submitAttemptTimestamp > 0 && Date.now() - submitAttemptTimestamp < SUBMIT_WINDOW_MS;
        const staged = getStagedJobMetadata(true);
        if ((recentSubmit || staged) && (!hasActiveFormFields() || hasVisibleSuccessMessage())) {
          commitApplicationIfPending(true);
        }
      }
    }
  }, 1000);

  document.addEventListener('click', handleClick, true);
  document.addEventListener('submit', handleSubmit, true);
  window.addEventListener('popstate', () => {
    if (isConfirmationUrl()) {
      const staged = getStagedJobMetadata(true);
      if (staged && (!hasActiveFormFields() || hasVisibleSuccessMessage())) {
        commitApplicationIfPending(true);
      }
    }
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
