import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSubmitTriggerElement,
  isConfirmationUrl,
  hasVisibleSuccessMessage,
  hasActiveFormFields,
  stageCurrentJobMetadata,
  getStagedJobMetadata,
  clearStagedJobMetadata,
  initSubmissionWatcher,
} from '../src/utils/submissionWatcher';
import { resetMockChromeStorage } from './setup';

describe('Submission Watcher & Job Tracker', () => {
  beforeEach(() => {
    resetMockChromeStorage({
      jobTrackerEnabled: true,
      autoTrackOnSubmit: true,
      applications: [],
    });
    sessionStorage.clear();
    document.body.innerHTML = '';
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  describe('REGRESSION GUARD: No Tracking Before Submit on Page Refresh', () => {
    it('MUST NOT track when user refreshes an active application form with inputs', async () => {
      // Simulate an active job application page (e.g. Darwinbox or standard ATS)
      document.body.innerHTML = `
        <form id="app-form">
          <div class="field">
            <label>First Name</label>
            <input name="firstName" value="" />
          </div>
          <div class="field">
            <label>Email Address</label>
            <input type="email" name="email" value="" />
          </div>
          <button type="submit">Submit Application</button>
        </form>
      `;

      const trackedApps: any[] = [];
      const unwatch = initSubmissionWatcher({
        onAutoTracked: (app) => trackedApps.push(app),
      });

      // Assert that active form fields are detected
      expect(hasActiveFormFields()).toBe(true);
      expect(hasVisibleSuccessMessage()).toBe(false);

      // Give any async timers a chance to fire
      await new Promise((r) => setTimeout(r, 100));

      // MUST NOT have tracked anything on page load/refresh
      expect(trackedApps.length).toBe(0);
      unwatch();
    });

    it('MUST NOT track on refresh even if the URL hash contains a lingering /success from previous test', async () => {
      // User refreshed the page after a previous test, so URL has a success hash, but active form is displayed
      window.location.hash = '#/ms/candidatev2/main/applications/a6aa650f812d09/success';

      document.body.innerHTML = `
        <form id="app-form">
          <input name="firstName" value="" />
          <input type="email" name="email" value="" />
          <button type="submit">Submit Application</button>
        </form>
      `;

      const trackedApps: any[] = [];
      const unwatch = initSubmissionWatcher({
        onAutoTracked: (app) => trackedApps.push(app),
      });

      expect(isConfirmationUrl()).toBe(true);
      expect(hasActiveFormFields()).toBe(true);

      await new Promise((r) => setTimeout(r, 100));

      // Active form guard must block false confirmation commit!
      expect(trackedApps.length).toBe(0);
      unwatch();
    });

    it('MUST NOT track when staged metadata was never submitted (submitted: false)', async () => {
      // Passive scan staged metadata
      stageCurrentJobMetadata({ company: 'LeadSquared', title: 'Frontend Engineer', descriptionSnippet: '' }, false);

      const staged = getStagedJobMetadata(true);
      expect(staged).toBeNull(); // requireSubmitted=true rejects unsubmitted staging

      document.body.innerHTML = `
        <input name="firstName" />
        <input name="lastName" />
      `;

      const trackedApps: any[] = [];
      const unwatch = initSubmissionWatcher({
        onAutoTracked: (app) => trackedApps.push(app),
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(trackedApps.length).toBe(0);
      unwatch();
    });
  });

  describe('Successful Submission Tracking', () => {
    it('tracks application when user clicks submit and success message appears in SPA', async () => {
      document.body.innerHTML = `
        <div id="company-header" class="company">LeadSquared</div>
        <h1>Senior Frontend Engineer</h1>
        <form id="job-form">
          <input name="firstName" value="Adarsh" />
          <button id="submit-btn" type="submit">Submit Application</button>
        </form>
        <div id="success-box" class="confirmation" style="display: none;">
          Your application has been submitted successfully!
        </div>
      `;

      const trackedApps: any[] = [];
      const unwatch = initSubmissionWatcher({
        onAutoTracked: (app) => trackedApps.push(app),
      });

      const submitBtn = document.getElementById('submit-btn')!;
      submitBtn.click();

      // Simulate SPA showing confirmation
      document.getElementById('job-form')!.style.display = 'none';
      document.getElementById('success-box')!.style.display = 'block';

      // Trigger mutation observer / checks
      await new Promise((r) => setTimeout(r, 400));

      expect(trackedApps.length).toBe(1);
      expect(trackedApps[0].company).toBe('LeadSquared');
      expect(trackedApps[0].title).toBe('Senior Frontend Engineer');
      expect(trackedApps[0].status).toBe('Applied');

      unwatch();
    });

    it('clears staged metadata after commit so subsequent page reloads do not duplicate', async () => {
      stageCurrentJobMetadata({ company: 'Acme Corp', title: 'Software Engineer', descriptionSnippet: '' }, true);
      expect(getStagedJobMetadata()).not.toBeNull();

      clearStagedJobMetadata();
      expect(getStagedJobMetadata()).toBeNull();
    });
  });

  describe('Submit Trigger Recognition', () => {
    it('identifies standard submit buttons and inputs', () => {
      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.textContent = 'Apply Now';
      expect(isSubmitTriggerElement(btn)).toBe(true);

      const inputSubmit = document.createElement('input');
      inputSubmit.type = 'submit';
      expect(isSubmitTriggerElement(inputSubmit)).toBe(true);
    });

    it('identifies ATS data attributes and class names', () => {
      const workdayBtn = document.createElement('button');
      workdayBtn.setAttribute('data-automation-id', 'bottom-submit-button');
      expect(isSubmitTriggerElement(workdayBtn)).toBe(true);

      const ashbyBtn = document.createElement('button');
      ashbyBtn.setAttribute('data-qa', 'submit-application');
      expect(isSubmitTriggerElement(ashbyBtn)).toBe(true);
    });

    it('identifies Web Component buttons (dbx-ds-button)', () => {
      const customBtn = document.createElement('dbx-ds-button');
      customBtn.setAttribute('label', 'Submit Application');
      expect(isSubmitTriggerElement(customBtn)).toBe(true);
    });

    it('identifies submit buttons when user clicks an inner span or icon', () => {
      const btn = document.createElement('button');
      btn.type = 'submit';
      const span = document.createElement('span');
      span.textContent = 'Submit';
      btn.appendChild(span);
      document.body.appendChild(btn);

      expect(isSubmitTriggerElement(span)).toBe(true);
    });
  });

  describe('Confirmation URL Detection', () => {
    it('matches standard ATS confirmation patterns', () => {
      expect(isConfirmationUrl('https://boards.greenhouse.io/acme/jobs/123/confirmation')).toBe(true);
      expect(isConfirmationUrl('https://jobs.lever.co/acme/123/thanks')).toBe(true);
      expect(isConfirmationUrl('https://jobs.ashbyhq.com/acme/application_submitted')).toBe(true);
      expect(isConfirmationUrl('https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/applications/123/success')).toBe(true);
      expect(isConfirmationUrl('https://workday.com/job?applied=true')).toBe(true);
      expect(isConfirmationUrl('https://company.com/apply?status=success')).toBe(true);
    });

    it('does NOT false-positive on application form URLs', () => {
      expect(isConfirmationUrl('https://boards.greenhouse.io/acme/jobs/123')).toBe(false);
      expect(isConfirmationUrl('https://jobs.lever.co/acme/123/apply')).toBe(false);
      expect(isConfirmationUrl('https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/applications/123')).toBe(false);
      expect(isConfirmationUrl('file:///home/user/darwinbox-test-app.html')).toBe(false);
    });
  });
});
