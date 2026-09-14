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
  CONFIRMATION_URL_REGEX,
} from '../src/utils/submissionWatcher';

describe('Workday ATS Tech Stack Support', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  describe('Workday Field Label Extraction (findFieldLabel)', () => {
    it('extracts label from Workday formField container and strips required asterisk', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-legalNameSection_firstName">
          <label data-automation-id="formLabel" id="lbl-fname">
            First Name
            <abbr class="requiredAsterisk" title="required" aria-hidden="true">*</abbr>
          </label>
          <div data-automation-id="formInput">
            <input data-automation-id="legalNameSection_firstName" id="input-fname" type="text" />
          </div>
        </div>
      `;

      const input = document.getElementById('input-fname') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('First Name');
    });

    it('extracts label when formLabel is a div instead of a label tag', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-legalNameSection_lastName">
          <div data-automation-id="formLabel">
            Last Name:
          </div>
          <div data-automation-id="formInput">
            <input data-automation-id="legalNameSection_lastName" id="input-lname" type="text" />
          </div>
        </div>
      `;

      const input = document.getElementById('input-lname') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('Last Name');
    });

    it('cleans required asterisk and aria-labelledby references correctly', () => {
      document.body.innerHTML = `
        <label data-automation-id="formLabel" id="lbl-email">
          Email Address <abbr class="requiredAsterisk">*</abbr>
        </label>
        <input data-automation-id="email" aria-labelledby="lbl-email" id="input-email" type="email" />
      `;

      const input = document.getElementById('input-email') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('Email Address');
    });
  });

  describe('Workday Field Classification (classifyField)', () => {
    it('classifies standard fields by Workday data-automation-id', () => {
      const createField = (automationId: string, tag: 'input' | 'textarea' = 'input') => {
        const el = document.createElement(tag) as HTMLInputElement | HTMLTextAreaElement;
        el.setAttribute('data-automation-id', automationId);
        return el;
      };

      expect(classifyField(createField('legalNameSection_firstName'), '')).toBe('firstName');
      expect(classifyField(createField('preferredNameSection_firstName'), '')).toBe('firstName');
      expect(classifyField(createField('legalNameSection_lastName'), '')).toBe('lastName');
      expect(classifyField(createField('preferredNameSection_lastName'), '')).toBe('lastName');
      expect(classifyField(createField('contactInformation_email'), '')).toBe('email');
      expect(classifyField(createField('email'), '')).toBe('email');
      expect(classifyField(createField('phone-number'), '')).toBe('phone');
      expect(classifyField(createField('phoneNumber'), '')).toBe('phone');
      expect(classifyField(createField('addressSection_postalCode'), '')).toBe('postalCode');
      expect(classifyField(createField('addressSection_countryRegion'), '')).toBe('state');
      expect(classifyField(createField('addressSection_city'), '')).toBe('city');
      expect(classifyField(createField('linkedinQuestion'), '')).toBe('linkedin');
      expect(classifyField(createField('githubQuestion'), '')).toBe('github');
      expect(classifyField(createField('websiteQuestion'), '')).toBe('portfolio');
      expect(classifyField(createField('coverLetter', 'textarea'), '')).toBe('cover_letter');
      expect(classifyField(createField('statementOfPurpose', 'textarea'), '')).toBe('cover_letter');
    });

    it('classifies generic textInputBox via parent Workday container data-automation-id', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-legalNameSection_firstName">
          <input data-automation-id="textInputBox" id="fn-box" type="text" />
        </div>
        <div data-automation-id="formField-addressSection_city">
          <input data-automation-id="textInputBox" id="city-box" type="text" />
        </div>
      `;

      const fnInput = document.getElementById('fn-box') as HTMLInputElement;
      const cityInput = document.getElementById('city-box') as HTMLInputElement;

      expect(classifyField(fnInput, 'First Name')).toBe('firstName');
      expect(classifyField(cityInput, 'City')).toBe('city');
    });

    it('classifies screening questions inside Workday questionnaires as custom_question', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-question-101">
          <label data-automation-id="formLabel">Are you legally authorized to work in the United States?</label>
          <input data-automation-id="textInputBox" id="q-auth" type="text" />
        </div>
        <div data-automation-id="formField-question-102">
          <label data-automation-id="formLabel">Please describe your experience with distributed systems:</label>
          <textarea data-automation-id="textAreaBox" id="q-desc"></textarea>
        </div>
      `;

      const qAuth = document.getElementById('q-auth') as HTMLInputElement;
      const qDesc = document.getElementById('q-desc') as HTMLTextAreaElement;

      expect(classifyField(qAuth, 'Are you legally authorized to work in the United States?')).toBe('custom_question');
      expect(classifyField(qDesc, 'Please describe your experience with distributed systems:')).toBe('custom_question');
    });
  });

  describe('Workday Metadata Extraction (extractJobMetadata)', () => {
    it('extracts job title from data-automation-id="jobPostingHeader"', () => {
      document.body.innerHTML = `
        <h2 data-automation-id="jobPostingHeader">Staff Distributed Systems Engineer</h2>
        <div data-automation-id="companyName">Workday Enterprise</div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Staff Distributed Systems Engineer');
      expect(meta.company).toBe('Workday Enterprise');
    });

    it('extracts company from Workday subdomain (e.g. nvidia.myworkdayjobs.com)', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://nvidia.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/1234');

      document.body.innerHTML = `
        <h1 data-automation-id="jobPostingHeader">Deep Learning Compiler Engineer</h1>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Deep Learning Compiler Engineer');
      expect(meta.company).toBe('Nvidia');
    });

    it('extracts company from multi-tenant path (e.g. myworkdayjobs.com/en-US/disney/job/...)', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://myworkdayjobs.com/en-US/disney/job/Streaming-Engineer_R123');

      document.body.innerHTML = `
        <h2 data-automation-id="jobPostingHeader">Streaming Infrastructure Engineer</h2>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Streaming Infrastructure Engineer');
      expect(meta.company).toBe('Disney');
    });

    it('extracts company from Workday header logo image alt attribute', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://wd5.myworkday.com/wday/cxs/company/jobs');

      document.body.innerHTML = `
        <div data-automation-id="bannerLogo">
          <img alt="Adobe Careers" src="/logo.png" />
        </div>
        <h2 data-automation-id="jobPostingHeader">Senior Cloud Architect</h2>
      `;

      const meta = extractJobMetadata();
      expect(meta.company).toBe('Adobe');
    });
  });

  describe('Workday Submission Watcher Triggers & URLs', () => {
    it('identifies Workday submit buttons (bottom-submit-button, page-navigation-submit-button)', () => {
      const btnBottom = document.createElement('button');
      btnBottom.setAttribute('data-automation-id', 'bottom-submit-button');

      const btnPageSubmit = document.createElement('button');
      btnPageSubmit.setAttribute('data-automation-id', 'page-navigation-submit-button');

      const btnReviewSubmit = document.createElement('button');
      btnReviewSubmit.textContent = 'Review and Submit';

      expect(isSubmitTriggerElement(btnBottom)).toBe(true);
      expect(isSubmitTriggerElement(btnPageSubmit)).toBe(true);
      expect(isSubmitTriggerElement(btnReviewSubmit)).toBe(true);
    });

    it('does not trigger on Workday back or add buttons', () => {
      const btnBack = document.createElement('button');
      btnBack.setAttribute('data-automation-id', 'page-navigation-back-button');
      btnBack.textContent = 'Back';

      const btnAdd = document.createElement('button');
      btnAdd.setAttribute('data-automation-id', 'add-button');
      btnAdd.textContent = 'Add Another';

      expect(isSubmitTriggerElement(btnBack)).toBe(false);
      expect(isSubmitTriggerElement(btnAdd)).toBe(false);
    });

    it('detects Workday confirmation URLs via isConfirmationUrl and regex', () => {
      expect(isConfirmationUrl('https://company.myworkdayjobs.com/en-US/careers/job/123/applicationSubmitted')).toBe(true);
      expect(isConfirmationUrl('https://company.myworkdayjobs.com/en-US/careers/job/123/applicationConfirmation')).toBe(true);
      expect(isConfirmationUrl('https://company.myworkdayjobs.com/en-US/careers/job/123/apply/submitted')).toBe(true);
      expect(CONFIRMATION_URL_REGEX.test('/applicationSubmitted')).toBe(true);
      expect(CONFIRMATION_URL_REGEX.test('/applicationConfirmation')).toBe(true);
    });

    it('detects Workday statusBanner and applicationSubmitted confirmation elements', () => {
      document.body.innerHTML = `
        <div data-automation-id="applicationSubmitted">
          <h2 data-automation-id="heading">Thank you for your application!</h2>
          <p>Your application was submitted successfully.</p>
        </div>
      `;

      expect(hasVisibleSuccessMessage()).toBe(true);
    });
  });

  describe('Full Workday Canvas Form Scanning', () => {
    it('accurately scans and categorizes an entire Workday candidate form', () => {
      document.body.innerHTML = `
        <h2 data-automation-id="jobPostingHeader">Principal Cloud Engineer</h2>
        <div data-automation-id="companyName">Workday Systems</div>

        <form>
          <div data-automation-id="formField-legalNameSection_firstName">
            <label data-automation-id="formLabel">First Name<abbr class="requiredAsterisk">*</abbr></label>
            <input data-automation-id="legalNameSection_firstName" type="text" />
          </div>

          <div data-automation-id="formField-legalNameSection_lastName">
            <label data-automation-id="formLabel">Last Name<abbr class="requiredAsterisk">*</abbr></label>
            <input data-automation-id="legalNameSection_lastName" type="text" />
          </div>

          <div data-automation-id="formField-contactInformation_email">
            <label data-automation-id="formLabel">Email Address<abbr class="requiredAsterisk">*</abbr></label>
            <input data-automation-id="email" type="email" />
          </div>

          <div data-automation-id="formField-phone-number">
            <label data-automation-id="formLabel">Phone Number</label>
            <input data-automation-id="phone-number" type="tel" />
          </div>

          <div data-automation-id="formField-addressSection_city">
            <label data-automation-id="formLabel">City</label>
            <input data-automation-id="addressSection_city" type="text" />
          </div>

          <div data-automation-id="formField-addressSection_countryRegion">
            <label data-automation-id="formLabel">State / Region</label>
            <input data-automation-id="addressSection_countryRegion" type="text" />
          </div>

          <div data-automation-id="formField-addressSection_postalCode">
            <label data-automation-id="formLabel">Postal Code</label>
            <input data-automation-id="addressSection_postalCode" type="text" />
          </div>

          <div data-automation-id="formField-linkedinQuestion">
            <label data-automation-id="formLabel">LinkedIn Profile</label>
            <input data-automation-id="linkedinQuestion" type="url" />
          </div>

          <div data-automation-id="formField-githubQuestion">
            <label data-automation-id="formLabel">GitHub Profile</label>
            <input data-automation-id="githubQuestion" type="url" />
          </div>

          <div data-automation-id="formField-coverLetter">
            <label data-automation-id="formLabel">Cover Letter</label>
            <textarea data-automation-id="coverLetter"></textarea>
          </div>

          <div data-automation-id="formField-question-1">
            <label data-automation-id="formLabel">What is your notice period?</label>
            <input data-automation-id="textInputBox" type="text" />
          </div>

          <button data-automation-id="bottom-submit-button">Submit Application</button>
        </form>
      `;

      const { standardFields, customQuestions } = scanFormFields();

      expect(standardFields.length).toBe(9);
      expect(customQuestions.length).toBe(2);

      const types = standardFields.map((f) => f.type);
      expect(types).toContain('firstName');
      expect(types).toContain('lastName');
      expect(types).toContain('email');
      expect(types).toContain('phone');
      expect(types).toContain('city');
      expect(types).toContain('state');
      expect(types).toContain('postalCode');
      expect(types).toContain('linkedin');
      expect(types).toContain('github');

      const coverField = customQuestions.find((f) => f.type === 'cover_letter');
      expect(coverField).toBeDefined();
      expect(coverField?.label).toBe('Cover Letter');

      const screeningField = customQuestions.find((f) => f.type === 'custom_question');
      expect(screeningField).toBeDefined();
      expect(screeningField?.label).toBe('What is your notice period?');
    });
  });
});
