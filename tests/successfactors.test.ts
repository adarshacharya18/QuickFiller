import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findFieldLabel,
  classifyField,
  extractJobMetadata,
  scanFormFields,
} from '../src/utils/scanner';
import {
  isSubmitTriggerElement,
  isConfirmationUrl,
  hasVisibleSuccessMessage,
  extractApplicationPortalUrl,
  stageCurrentJobMetadata,
  initSubmissionWatcher,
} from '../src/utils/submissionWatcher';
import { deriveJobPostingUrl } from '../src/utils/jdResolver';
import { resetMockChromeStorage } from './setup';

describe('SAP SuccessFactors ATS Support (career4.successfactors.com & Global Clusters)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    resetMockChromeStorage({
      jobTrackerEnabled: true,
      autoTrackOnSubmit: true,
      applications: [],
    });
    sessionStorage.clear();
    document.body.replaceChildren();
    document.title = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.replaceChildren();
    delete (window as any).location;
    (window as any).location = originalLocation;
    vi.restoreAllMocks();
  });

  describe('Field Classification with data-field-id and SAP UI attributes', () => {
    const createField = (
      attributes: Record<string, string>,
      tag: 'input' | 'textarea' = 'input'
    ) => {
      const el = document.createElement(tag) as HTMLInputElement | HTMLTextAreaElement;
      Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    it('classifies applicant contact fields using data-field-id', () => {
      expect(classifyField(createField({ 'data-field-id': 'firstName' }), '')).toBe('firstName');
      expect(classifyField(createField({ 'data-field-id': 'lastName' }), '')).toBe('lastName');
      expect(classifyField(createField({ 'data-field-id': 'cellPhone' }), '')).toBe('phone');
      expect(classifyField(createField({ 'data-field-id': 'contactPhone' }), '')).toBe('phone');
      expect(classifyField(createField({ 'data-field-id': 'contactEmail' }), '')).toBe('email');
      expect(classifyField(createField({ 'data-field-id': 'emailAddress' }), '')).toBe('email');
      expect(classifyField(createField({ 'data-field-id': 'zip' }), '')).toBe('postalCode');
      expect(classifyField(createField({ 'data-field-id': 'postalCode' }), '')).toBe('postalCode');
      expect(classifyField(createField({ 'data-field-id': 'city' }), '')).toBe('city');
      expect(classifyField(createField({ 'data-field-id': 'state' }), '')).toBe('state');
      expect(classifyField(createField({ 'data-field-id': 'country' }), '')).toBe('custom_question');
      expect(classifyField(createField({ 'data-field-id': 'address1' }), '')).toBe('custom_question');
      expect(classifyField(createField({ 'data-field-id': 'companyName' }), '')).toBe('company');
      expect(classifyField(createField({ 'data-field-id': 'jobTitle' }), '')).toBe('jobTitle');
      expect(classifyField(createField({ 'data-field-id': 'linkedinUrl' }), '')).toBe('linkedin');
      expect(classifyField(createField({ 'data-field-id': 'githubUrl' }), '')).toBe('github');
    });

    it('classifies SAP UI5 specific attributes (data-sap-ui)', () => {
      expect(classifyField(createField({ 'data-sap-ui': 'application--fname-inner' }), '')).toBe('firstName');
      expect(classifyField(createField({ 'data-sap-ui': 'application--lname-inner' }), '')).toBe('lastName');
      expect(classifyField(createField({ 'data-sap-ui': 'application--email-inner' }), '')).toBe('email');
      expect(classifyField(createField({ 'data-sap-ui': 'application--phone-inner' }), '')).toBe('phone');
    });

    it('extracts field label from SuccessFactors form control containers', () => {
      document.body.innerHTML = `
        <div class="sf-form-group">
          <label for="fname_input" class="sf-form-label">First Name <span class="required">*</span></label>
          <input id="fname_input" data-field-id="firstName" type="text" />
        </div>
      `;
      const input = document.getElementById('fname_input') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('First Name');
    });
  });

  describe('Metadata Extraction (extractJobMetadata) on SuccessFactors', () => {
    it('extracts job title and company from career4.successfactors.com with company query parameter', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=105421&career_ns=job_listing'
      );
      document.title = 'Lead Cloud Architect - Tata India - SAP SuccessFactors';

      document.body.innerHTML = `
        <h1 class="sf-job-title">Lead Cloud Architect</h1>
        <div class="jobdescription">
          <p>We are seeking a Lead Cloud Architect to build scalable infrastructure.</p>
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Lead Cloud Architect');
      expect(meta.company).toBe('Tata India');
      expect(meta.descriptionSnippet).toContain('Lead Cloud Architect to build scalable infrastructure');
    });

    it('cleans SAP SuccessFactors branding suffix from document.title when heading is absent', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career4.successfactors.com/career?company=boeing&career_job_req_id=98765&career_ns=job_listing'
      );
      document.title = 'Senior Avionics Software Engineer - Boeing - SAP SuccessFactors';

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Senior Avionics Software Engineer');
      expect(meta.company).toBe('Boeing');
    });

    it('extracts company from headerLogo image alt attribute on SuccessFactors portals', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career8.successfactors.com/career?company=lamresearch&career_job_req_id=44321&career_ns=job_listing'
      );
      document.title = 'Principal Process Engineer - SAP SuccessFactors';

      document.body.innerHTML = `
        <div class="headerLogo">
          <img src="/logo.png" alt="Lam Research Careers" />
        </div>
        <h1 id="jobTitle">Principal Process Engineer</h1>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Principal Process Engineer');
      expect(meta.company).toBe('Lam Research');
    });

    it('extracts company from DOM org-name or company-name elements', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career5.successfactors.eu/career?company=novartis&career_job_req_id=77889&career_ns=job_listing'
      );
      document.title = 'Biomedical Data Scientist - SAP SuccessFactors';

      document.body.innerHTML = `
        <div class="header-company-name">Novartis Pharma</div>
        <div class="jobtitle">Biomedical Data Scientist</div>
        <div class="job-description">
          <p>Lead advanced bioinformatics data pipelines.</p>
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Biomedical Data Scientist');
      expect(meta.company).toBe('Novartis Pharma');
    });

    it('extracts description from .jobdescription, .job-description, or #job-description containers', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_listing'
      );

      document.body.innerHTML = `
        <h1>Full Stack Engineer</h1>
        <div class="company">Tata Consultancy Services</div>
        <div class="jobdescription">
          <h3>About the Role</h3>
          <p>Develop end-to-end cloud applications using React and Node.js.</p>
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.descriptionSnippet).toContain('Develop end-to-end cloud applications');
    });
  });

  describe('Canonical Job Description URL Derivation (deriveJobPostingUrl)', () => {
    it('converts application flow URL (career_ns=job_application) to public job posting URL (career_ns=job_listing)', () => {
      const appUrl =
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_application';
      const derived = deriveJobPostingUrl(appUrl);
      expect(derived).toBe(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_listing'
      );
    });

    it('converts global cluster application URL (career5.successfactors.eu)', () => {
      const appUrl =
        'https://career5.successfactors.eu/career?career_ns=job_application&company=novartis&career_job_req_id=98765';
      const derived = deriveJobPostingUrl(appUrl);
      expect(derived).toBe(
        'https://career5.successfactors.eu/career?career_ns=job_listing&company=novartis&career_job_req_id=98765'
      );
    });

    it('converts /jobapplication path to /jobreqentry path', () => {
      const appUrl =
        'https://career4.successfactors.com/sf/jobapplication?company=tataindiaP&jobId=12345';
      const derived = deriveJobPostingUrl(appUrl);
      expect(derived).toBe(
        'https://career4.successfactors.com/sf/jobreqentry?company=tataindiaP&jobId=12345'
      );
    });

    it('returns null if the URL is already the canonical job listing', () => {
      const listingUrl =
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_listing';
      const derived = deriveJobPostingUrl(listingUrl);
      expect(derived).toBeNull();
    });
  });

  describe('Submission Watcher & Confirmation Handling', () => {
    it('identifies SAP UI5 and SuccessFactors buttons as submit triggers', () => {
      const sapMBtn = document.createElement('button');
      sapMBtn.className = 'sapMBtn sapMBtnBase';
      sapMBtn.textContent = 'Submit Application';
      expect(isSubmitTriggerElement(sapMBtn)).toBe(true);

      const sapUiBtn = document.createElement('button');
      sapUiBtn.className = 'sapUiBtn';
      sapUiBtn.textContent = 'Apply Now';
      expect(isSubmitTriggerElement(sapUiBtn)).toBe(true);
    });

    it('recognizes SuccessFactors confirmation and submission URLs', () => {
      expect(
        isConfirmationUrl(
          'https://career4.successfactors.com/career?company=tataindiaP&career_ns=job_application_status&status=submitted'
        )
      ).toBe(true);

      expect(
        isConfirmationUrl(
          'https://career4.successfactors.com/career?company=tataindiaP&navBarLevel=MY_APPLICATIONS'
        )
      ).toBe(true);
    });

    it('detects SAP UI message strips and success banners', () => {
      document.body.innerHTML = `
        <div class="sapMMessageStripSuccess" style="display: block;">
          Your application has been successfully submitted!
        </div>
      `;
      expect(hasVisibleSuccessMessage()).toBe(true);

      document.body.innerHTML = `
        <div class="applicationSuccess" style="display: block;">
          Thank you for applying. We have received your submission.
        </div>
      `;
      expect(hasVisibleSuccessMessage()).toBe(true);
    });

    it('extracts "My Applications" candidate portal link for tracking', () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_application'
      );

      document.body.innerHTML = `
        <div class="sapMMessageStripSuccess">
          Application Submitted!
        </div>
        <nav class="sf-nav">
          <a class="nav-item" href="/career?company=tataindiaP&navBarLevel=MY_APPLICATIONS">
            View My Applications
          </a>
        </nav>
      `;

      const portalUrl = extractApplicationPortalUrl(document);
      expect(portalUrl).toBe(
        'https://career4.successfactors.com/career?company=tataindiaP&navBarLevel=MY_APPLICATIONS'
      );
    });
  });

  describe('Full Auto-Tracking Flow on career4.successfactors.com', () => {
    it('stages metadata and auto-tracks job when SAP submission button is clicked', async () => {
      delete (window as any).location;
      (window as any).location = new URL(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_application'
      );
      document.title = 'Staff Cloud Architect - Tata India - SAP SuccessFactors';

      document.body.innerHTML = `
        <h1 class="sf-job-title">Staff Cloud Architect</h1>
        <div class="company">Tata India</div>
        <form id="sf-apply-form">
          <input data-field-id="firstName" value="Adarsh" />
          <button type="submit" class="sapMBtn" id="btn-submit">Submit Application</button>
        </form>
      `;

      const trackedApps: any[] = [];
      const unwatch = initSubmissionWatcher({
        onAutoTracked: (app) => trackedApps.push(app),
      });

      // Submit form
      const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;
      submitBtn.click();

      // Simulate post-submit DOM transition to success banner
      document.body.innerHTML = `
        <div class="sapMMessageStripSuccess">
          Your application has been successfully submitted!
        </div>
        <a href="/career?company=tataindiaP&navBarLevel=MY_APPLICATIONS">My Applications</a>
      `;

      // Allow watchers and mutation observers to process
      await new Promise((r) => setTimeout(r, 300));

      expect(trackedApps.length).toBe(1);
      expect(trackedApps[0].title).toBe('Staff Cloud Architect');
      expect(trackedApps[0].company).toBe('Tata India');
      expect(trackedApps[0].portalUrl).toBe(
        'https://career4.successfactors.com/career?company=tataindiaP&navBarLevel=MY_APPLICATIONS'
      );
      expect(trackedApps[0].url).toBe(
        'https://career4.successfactors.com/career?company=tataindiaP&career_job_req_id=12345&career_ns=job_listing'
      );

      unwatch();
    });
  });
});
