import { JobMetadata, extractJobMetadata, isElementVisible, querySelectorAllDeep } from './scanner';
import { JobApplication } from '../types/applications';
import { getStorageData, updateStorageData, isExtensionValid } from './storage';
import { isSafeWebUrl } from './security';
import { deriveJobPostingUrl } from './jdResolver';

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
  /(\/applicationsubmitted|\/applicationconfirmation|\/confirmation|\/confirm(?:\/|\?|#|$|\b)|\/jobconfirm|\/thank-you|\/thanks|\/applied|\/submitted|application[-_]?submitted|application[-_]?confirmation|\/success|applied=true|status=success|submitted=1|\/formresponse|\/responsepage\.aspx)/i;

export const SUCCESS_TEXT_REGEX =
  /((application|form|submission|profile) (has been |got |was )?(successfully |sucessfully )?(submitted|submited)|(application|form|submission|profile) (submitted|submited) (successfully|sucessfully)|thank you for (your application|applying|your interest)|\bthank you\b\s*!*|\bthanks\b\s*!*|your (application|form|profile) (has been|was|got) received|(application|form|profile) (received|complete)|we('ve| have) received your (application|profile)|we appreciate your interest in|submission successful|successfully submitted|your response (has been|was) (recorded|submitted)|response (has been )?(recorded|submitted)|submit another response)/i;

/**
 * Selectors identifying candidate portal navigation elements across ATS platforms (Workday, SmartRecruiters, Darwinbox, etc.).
 */
export const PORTAL_AUTOMATION_SELECTORS = [
  '[data-automation-id="candidateHomeLink"]',
  '[data-automation-id="viewApplicationButton"]',
  '[data-automation-id="candidateHome"]',
  '[data-automation-id*="candidateHome"]',
  '[data-automation-id*="candidate-home"]',
  '[data-automation-id*="userHome"]',
  '[data-automation-id*="user-home"]',
  '[data-automation-id*="viewApplication"]',
  '[data-automation-id*="myApplications"]',
  '[data-automation-id*="my-applications"]',
  '[data-automation-id*="applicationStatus"]',
  '[data-qa*="candidate-portal"]',
  '[data-qa*="my-applications"]',
  '[data-testid*="candidate-home"]',
  '[data-testid*="application-status"]',
  'a.candidate-home-link',
  'a.portal-link',
  'a.my-applications-link',
];

export const PORTAL_TEXT_REGEX =
  /(candidate\s*(home|portal)|applicant\s*(home|portal)|view\s*(your\s*|my\s*)?application\s*status|check\s*(your\s*|my\s*)?(application\s*)?status|track\s*(your\s*|my\s*)?application|my\s*applications|my\s*submissions|view\s*submitted\s*application|manage\s*(your\s*|my\s*)?applications|application\s*status)/i;

export const PORTAL_HREF_REGEX =
  /(\/candidatehome|\/userhome|\/candidate-home|\/user-home|\/candidate-portal|\/applicant-portal|\/my-applications|\/myapplications|my\.smartrecruiters\.com|my\.greenhouse\.io|\/application[-_]?status|\/candidatev2\/main\/applications|\/my_submissions)/i;

export const EXCLUDED_PORTAL_TEXT_REGEX =
  /^(careers?(\s*home)?|home|back|back\s*to.*|search\s*jobs|browse\s*jobs|view\s*(all\s*|other\s*)?jobs|explore\s*(all\s*|other\s*)?jobs|privacy(\s*policy)?|terms(\s*of\s*service)?|help|contact(\s*us)?|faq|sign\s*out|log\s*out|sign\s*in|log\s*in)$/i;

export const EXCLUDED_PORTAL_HREF_REGEX =
  /(privacy|terms|legal|help|contact|faq|signout|logout|search|browse|\/jobs\/?$|\/careers\/?$|linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|github\.com)/i;

function extractSafeHref(elem: HTMLElement): string | null {
  let raw =
    elem.getAttribute('href') ||
    elem.getAttribute('data-href') ||
    elem.getAttribute('data-url');

  if (!raw) {
    const childAnchor = elem.querySelector('a[href]');
    if (childAnchor) {
      raw = childAnchor.getAttribute('href');
    }
  }

  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:')) {
    return null;
  }

  try {
    const base =
      typeof window !== 'undefined' && window.location ? window.location.href : 'http://localhost';
    const resolved = new URL(trimmed, base).href;
    if (isSafeWebUrl(resolved) && (resolved.startsWith('http://') || resolved.startsWith('https://'))) {
      return resolved;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Scans the current DOM (or provided root element) for candidate portal / application tracker links.
 * Used when an application confirmation is detected or when the user tracks a job.
 */
export function extractApplicationPortalUrl(root: Document | Element = document): string | null {
  // If the current window location itself is already a candidate portal URL, return it
  if (typeof window !== 'undefined' && window.location && window.location.href) {
    if (PORTAL_HREF_REGEX.test(window.location.href)) {
      return window.location.href;
    }
  }

  // 0. Greenhouse candidate portal (MyGreenhouse)
  if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('greenhouse.io')) {
    const ghPortalLink = root.querySelector('a[href*="my.greenhouse.io"]');
    if (ghPortalLink) {
      const href = extractSafeHref(ghPortalLink as HTMLElement);
      if (href) return href;
    }
    const trackingWidget = root.querySelector('.application_tracking_widget, [class*="application_tracking"]');
    if (trackingWidget && isElementVisible(trackingWidget as HTMLElement)) {
      const widgetAnchor = trackingWidget.querySelector('a[href]');
      if (widgetAnchor) {
        const href = extractSafeHref(widgetAnchor as HTMLElement);
        if (href) return href;
      }
      return 'https://my.greenhouse.io';
    }
  }

  // 1. High-priority ATS specific selectors
  const priorityElements = querySelectorAllDeep<HTMLElement>(
    PORTAL_AUTOMATION_SELECTORS.join(','),
    root
  );

  for (const el of priorityElements) {
    if (!isElementVisible(el)) continue;
    const href = extractSafeHref(el);
    if (href && !EXCLUDED_PORTAL_HREF_REGEX.test(href)) {
      return href;
    }
  }

  // 2. Scan within dedicated confirmation / success containers
  const successContainers = querySelectorAllDeep<HTMLElement>(
    '[data-automation-id*="applicationSubmitted"], [data-automation-id*="applicationConfirmation"], [data-automation-id*="statusBanner"], [data-automation-id*="alert-success"], .confirmation, .success, [role="alert"]',
    root
  );

  for (const container of successContainers) {
    if (!isElementVisible(container)) continue;
    const links = querySelectorAllDeep<HTMLElement>('a[href], button[data-href], button[data-url]', container);
    for (const el of links) {
      if (!isElementVisible(el)) continue;
      const text = (el.textContent || '').trim();
      const href = extractSafeHref(el);
      if (!href) continue;

      if (EXCLUDED_PORTAL_TEXT_REGEX.test(text) || EXCLUDED_PORTAL_HREF_REGEX.test(href)) {
        continue;
      }

      if (PORTAL_TEXT_REGEX.test(text) || PORTAL_HREF_REGEX.test(href)) {
        return href;
      }
    }
  }

  // 3. Scan all anchor tags across the DOM
  const allAnchors = querySelectorAllDeep<HTMLElement>('a[href]', root);
  for (const anchor of allAnchors) {
    if (!isElementVisible(anchor)) continue;
    const text = (anchor.textContent || '').trim();
    const href = extractSafeHref(anchor);
    if (!href) continue;

    if (EXCLUDED_PORTAL_TEXT_REGEX.test(text) || EXCLUDED_PORTAL_HREF_REGEX.test(href)) {
      continue;
    }

    if (PORTAL_HREF_REGEX.test(href)) {
      return href;
    }

    if (PORTAL_TEXT_REGEX.test(text)) {
      return href;
    }
  }

  return null;
}

/**
 * Saves or updates the currently viewed job candidate into session storage and chrome.storage.local.
 */
export function stageCurrentJobMetadata(
  metadata: JobMetadata | null,
  submitted: boolean = true
): void {
  if (!metadata) return;
  const title = (metadata.title || '').trim() || 'Job Application';
  const company = (metadata.company || '').trim() || 'Company';
  const staged: StagedJob = {
    company,
    title,
    url: window.location.href,
    timestamp: Date.now(),
    submitted,
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(staged));
  } catch {
    // Ignore storage quota or cross-origin restrictions
  }
  try {
    // Cross-origin and multi-tab fallback (e.g. boards.greenhouse.io -> job-boards.greenhouse.io)
    updateStorageData({ lastStagedJob: staged }).catch(() => {});
  } catch {}
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
 * Clears the staged submission from session storage and storage.local.
 */
export function clearStagedJobMetadata(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
  try {
    updateStorageData({ lastStagedJob: null }).catch(() => {});
  } catch {}
}

/**
 * Checks if a candidate title string is a generic confirmation message rather than an actual role.
 */
export function isGenericConfirmationTitle(title?: string | null): boolean {
  if (!title || typeof title !== 'string') return true;
  const clean = title.trim();
  if (clean.length < 3) return true;
  return /^(thank\s*you(\s*for\s*applying)?|application\s*(submitted|received|confirmation|complete)|submission\s*(successful|received|complete)|confirmation|success|applied|job\s*application)$/i.test(
    clean
  );
}

/**
 * Scans confirmation DOM for links pointing back to the original job post.
 */
export function findJobPostingLinkOnConfirmation(root: Document | Element = document): string | null {
  const anchors = root.querySelectorAll('a[href]');
  for (const a of anchors) {
    const text = (a.textContent || '').trim();
    const href = a.getAttribute('href') || '';
    if (/back to (job|post|listing|position)/i.test(text) && href) {
      return href;
    }
    if (/\/jobs\/\d+/i.test(href) && !/\/confirmation/i.test(href)) {
      return href;
    }
  }
  return null;
}

/**
 * Tests if an element represents an application submission trigger button.
 */
export function isSubmitTriggerElement(elem: HTMLElement | null): boolean {
  if (!elem) return false;

  const tagName = elem.tagName.toLowerCase();
  const automationId = (elem.getAttribute('data-automation-id') || '').toLowerCase();
  const dataQa = (elem.getAttribute('data-qa') || '').toLowerCase();
  const dataTestId = (
    elem.getAttribute('data-testid') ||
    elem.getAttribute('data-test-id') ||
    elem.getAttribute('data-cy') ||
    ''
  ).toLowerCase();
  const id = (elem.id || '').toLowerCase();
  const className = (typeof elem.className === 'string' ? elem.className : '').toLowerCase();
  const role = (elem.getAttribute('role') || '').toLowerCase();
  const type = (elem.getAttribute('type') || '').toLowerCase();
  const text = (elem.textContent || '').trim();

  // Negative check: never trigger on Back, Cancel, Previous, Close, Remove, Add, etc.
  if (
    /^(back|cancel|previous|prev|close|add|remove|delete|save for later)$/i.test(text) ||
    /back-button|cancel-button|prev-button|close-button|delete-button|remove-button|add-button/i.test(
      automationId || dataTestId
    )
  ) {
    return false;
  }

  // 1. Direct submit input or button
  if (elem.tagName === 'INPUT' && (elem as HTMLInputElement).type === 'submit') {
    return true;
  }
  if (elem.tagName === 'BUTTON' && (type === 'submit' || (elem as HTMLButtonElement).type === 'submit')) {
    return true;
  }

  // 2. ATS / Web Component specific attributes (Workday, Greenhouse, Ashby, Lever, Darwinbox, Angular Material)
  if (
    type === 'submit' ||
    automationId.includes('submit') ||
    automationId === 'bottom-submit-button' ||
    automationId === 'page-navigation-submit-button' ||
    dataQa.includes('submit') ||
    dataTestId.includes('submit') ||
    dataTestId === 'submit-application-btn' ||
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
      /^(submit(\s*(application|form|now))?|apply(\s*now)?|review\s*(and|&)\s*submit|complete\s*(application|submission)|send\s*application)$/i.test(
        hostLabel.trim()
      )
    ) {
      return true;
    }
  }

  // 4. Button / link text content inspection
  if (
    /^(submit(\s*(application|form|now))?|apply(\s*now)?|review\s*(and|&)\s*submit|complete\s*(application|submission)|send\s*application)$/i.test(
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
  // Check Workday, Microsoft Forms, and Angular ATS (CRISIL) specific status banners and success containers
  const specificSuccess = document.querySelector(
    '[data-automation-id="applicationSubmitted"], [data-automation-id="applicationConfirmation"], [data-automation-id="statusBanner"], [data-automation-id="successMessage"], [data-automation-id="alert-success"], [data-automation-id="thankYouMessage"], app-jobconfirm, lib-apply-confirmation, .jobConfirm-sec, .apply-confirmation, .office-form-thank-you, .swal2-container, .swal2-popup'
  );
  if (specificSuccess && isElementVisible(specificSuccess as HTMLElement)) {
    const txt = (specificSuccess.textContent || '').trim();
    if (
      txt &&
      (SUCCESS_TEXT_REGEX.test(txt) ||
        /submitted|submited|thank you|success|sucess|congratulations|thanks/i.test(txt))
    ) {
      return true;
    }
  }

  const prominentElements = querySelectorAllDeep<HTMLElement>(
    'h1, h2, h3, h4, h5, [role="alert"], [data-automation-id*="success"], [data-automation-id*="confirmation"], [data-automation-id="thankYouMessage"], [id*="submitted"], [id*="success"], [class*="submitted"], [class*="success"], [class*="confirmation"], [class*="Confirmation"], app-jobconfirm, lib-apply-confirmation, .jobConfirm-sec, .apply-confirmation, [class*="jobConfirm"], [class*="apply-confirmation"], .confirmation, .success, .swal2-title, .swal2-html-container, .freebirdFormviewerViewResponseConfirmationMessage, .office-form-thank-you, .office-form-thank-you-title, .office-form-thank-you-sub-title',
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

  const teardown = () => {
    if (!isListening) return;
    isListening = false;
    try {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      window.removeEventListener('popstate', handlePopState);
      clearInterval(urlCheckInterval);
      observer.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  };

  // Helper to commit application to local storage
  const commitApplicationIfPending = async (forceCommit = false) => {
    if (!isListening || !isExtensionValid()) {
      teardown();
      return;
    }

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

    let storage;
    try {
      storage = await getStorageData();
    } catch {
      return;
    }

    if (storage.jobTrackerEnabled === false || storage.autoTrackOnSubmit === false) {
      return;
    }

    let staged: StagedJob | null = getStagedJobMetadata();

    // Cross-origin and multi-tab fallback (e.g. boards.greenhouse.io -> job-boards.greenhouse.io)
    if (!staged && storage.lastStagedJob) {
      const timeDiff = Date.now() - (storage.lastStagedJob.timestamp || 0);
      if (timeDiff < STAGE_EXPIRATION_MS) {
        const lastUrl = (storage.lastStagedJob.url || '').toLowerCase();
        const currentUrl = window.location.href.toLowerCase();
        const derived = (deriveJobPostingUrl(currentUrl) || '').toLowerCase();
        let isHostMatch = false;
        try {
          isHostMatch = currentUrl.includes(new URL(storage.lastStagedJob.url).hostname.toLowerCase());
        } catch {}

        if (
          lastUrl.includes(window.location.hostname.toLowerCase()) ||
          isHostMatch ||
          lastUrl === derived ||
          (storage.lastStagedJob.company &&
            window.location.pathname.toLowerCase().includes(storage.lastStagedJob.company.toLowerCase()))
        ) {
          staged = { ...storage.lastStagedJob };
        }
      }
    }

    if (!staged) {
      const derivedUrl = deriveJobPostingUrl(window.location.href);
      const backToJobLink = findJobPostingLinkOnConfirmation(document);
      const targetUrl = backToJobLink
        ? (deriveJobPostingUrl(backToJobLink) || backToJobLink)
        : (derivedUrl || window.location.href);

      const meta = extractJobMetadata();
      let title = meta.title;
      let company = meta.company;

      if (isGenericConfirmationTitle(title)) {
        title = company && company !== 'Company' ? `${company} Application` : 'Job Application';
      }

      staged = {
        company: company || 'Company',
        title: title || 'Job Application',
        url: targetUrl,
        timestamp: Date.now(),
        submitted: true,
      };
    } else {
      // Clean staged URL if it was on a confirmation URL or has query tracking parameters
      const cleanUrl = deriveJobPostingUrl(staged.url);
      if (cleanUrl) {
        staged.url = cleanUrl;
      }
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

    // Scan for candidate portal link on the confirmation / success DOM
    const portalUrl = extractApplicationPortalUrl(document) || undefined;

    if (isAlreadyTracked) {
      if (portalUrl) {
        let hasChanges = false;
        const updatedApps = currentApps.map((a) => {
          const normAppUrl = a.url.split('?')[0].replace(/\/$/, '').toLowerCase();
          const matches =
            normAppUrl === normalizedStagedUrl ||
            (a.company.toLowerCase() === staged!.company.toLowerCase() &&
              a.title.toLowerCase() === staged!.title.toLowerCase());
          if (matches && (!a.portalUrl || a.portalUrl !== portalUrl)) {
            hasChanges = true;
            return { ...a, portalUrl, updatedAt: new Date().toISOString() };
          }
          return a;
        });
        if (hasChanges) {
          try {
            await updateStorageData({ applications: updatedApps });
            const updatedApp = updatedApps.find((a) => a.portalUrl === portalUrl);
            if (updatedApp) {
              options.onAutoTracked(updatedApp);
            }
          } catch {}
        }
      }
      clearStagedJobMetadata();
      submitAttemptTimestamp = 0;
      return;
    }

    const newApp: JobApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company: staged.company,
      title: staged.title,
      url: staged.url,
      portalUrl,
      appliedDate: new Date().toISOString(),
      status: 'Applied',
      notes: 'Auto-tracked on application submission',
      updatedAt: new Date().toISOString(),
    };

    const updatedApps = [newApp, ...currentApps];
    try {
      await updateStorageData({ applications: updatedApps });
    } catch {
      return;
    }
    clearStagedJobMetadata();
    submitAttemptTimestamp = 0;

    options.onAutoTracked(newApp);
  };

  // Helper to enrich existing tracked applications if portal link renders asynchronously on success page
  const enrichTrackedApplicationsWithPortal = async () => {
    if (!isListening || !isExtensionValid()) {
      teardown();
      return;
    }
    const portalUrl = extractApplicationPortalUrl(document);
    if (!portalUrl) return;

    let storage;
    try {
      storage = await getStorageData();
    } catch {
      return;
    }
    const currentApps = storage?.applications || [];
    if (currentApps.length === 0) return;

    let hasChanges = false;
    const updatedApps = currentApps.map((a) => {
      const isRecent = Date.now() - new Date(a.appliedDate || 0).getTime() < 15 * 60 * 1000;
      let isDomainMatch = false;
      try {
        isDomainMatch = new URL(a.url).hostname === window.location.hostname;
      } catch {
        isDomainMatch = false;
      }

      if ((isRecent || isDomainMatch) && (!a.portalUrl || a.portalUrl !== portalUrl)) {
        hasChanges = true;
        return { ...a, portalUrl, updatedAt: new Date().toISOString() };
      }
      return a;
    });

    if (hasChanges) {
      try {
        await updateStorageData({ applications: updatedApps });
        const updatedApp = updatedApps.find((a) => a.portalUrl === portalUrl);
        if (updatedApp) {
          options.onAutoTracked(updatedApp);
        }
      } catch {}
    }
  };

  // 1. Check if user landed on a confirmation page via redirect
  if (isConfirmationUrl()) {
    const staged = getStagedJobMetadata(true);
    if (
      (staged || !hasActiveFormFields() || hasVisibleSuccessMessage()) &&
      (!hasActiveFormFields() || hasVisibleSuccessMessage())
    ) {
      commitApplicationIfPending(true);
    } else if (hasVisibleSuccessMessage()) {
      enrichTrackedApplicationsWithPortal();
    }
  }

  // If page contains active application form fields, proactively stage current job metadata
  if (hasActiveFormFields()) {
    const meta = extractJobMetadata();
    if (meta.title && meta.title !== 'Job Application') {
      stageCurrentJobMetadata(meta, false);
    }
  }

  const handleUserSubmitIntent = () => {
    if (!isListening || !isExtensionValid()) {
      teardown();
      return;
    }
    submitAttemptTimestamp = Date.now();
    const meta = extractJobMetadata();
    stageCurrentJobMetadata(meta, true);

    // Staggered check intervals to capture SPA DOM updates
    [100, 300, 700, 1500].forEach((delay) => {
      setTimeout(() => {
        if (!isListening || !isExtensionValid()) {
          teardown();
          return;
        }
        if (hasVisibleSuccessMessage() || (isConfirmationUrl() && !hasActiveFormFields())) {
          commitApplicationIfPending();
        }
      }, delay);
    });
  };

  // 2. Click listener for submit buttons
  const handleClick = (e: MouseEvent) => {
    if (!isListening) return;
    if (!isExtensionValid()) {
      teardown();
      return;
    }
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
    if (!isExtensionValid()) {
      teardown();
      return;
    }
    handleUserSubmitIntent();
  };

  // 4. DOM MutationObserver to catch in-page SPA success states
  const observer = new MutationObserver(() => {
    if (!isListening) return;
    if (!isExtensionValid()) {
      teardown();
      return;
    }
    const recentSubmit =
      submitAttemptTimestamp > 0 && Date.now() - submitAttemptTimestamp < SUBMIT_WINDOW_MS;

    if (
      (recentSubmit && (hasVisibleSuccessMessage() || (isConfirmationUrl() && !hasActiveFormFields()))) ||
      (isConfirmationUrl() && !hasActiveFormFields() && hasVisibleSuccessMessage())
    ) {
      commitApplicationIfPending(true);
    } else if (hasVisibleSuccessMessage() || isConfirmationUrl()) {
      enrichTrackedApplicationsWithPortal();
    }
  });

  // 5. URL change detection (SPA navigation)
  let lastUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    if (!isListening) return;
    if (!isExtensionValid()) {
      teardown();
      return;
    }
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isConfirmationUrl()) {
        const recentSubmit =
          submitAttemptTimestamp > 0 && Date.now() - submitAttemptTimestamp < SUBMIT_WINDOW_MS;
        const staged = getStagedJobMetadata(true);
        if (
          (recentSubmit || staged || !hasActiveFormFields() || hasVisibleSuccessMessage()) &&
          (!hasActiveFormFields() || hasVisibleSuccessMessage())
        ) {
          commitApplicationIfPending(true);
        }
      }
    }
  }, 1000);

  const handlePopState = () => {
    if (!isListening || !isExtensionValid()) {
      teardown();
      return;
    }
    if (isConfirmationUrl()) {
      const staged = getStagedJobMetadata(true);
      if (
        (staged || !hasActiveFormFields() || hasVisibleSuccessMessage()) &&
        (!hasActiveFormFields() || hasVisibleSuccessMessage())
      ) {
        commitApplicationIfPending(true);
      }
    }
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('submit', handleSubmit, true);
  window.addEventListener('popstate', handlePopState);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Teardown
  return teardown;
}
