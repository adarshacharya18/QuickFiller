import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findFieldLabel,
  classifyField,
  extractJobMetadata,
  scanFormFields,
} from '../src/utils/scanner';
import { setNativeInputValue, setNativeRadioChecked } from '../src/utils/autofill';
import { extractInlineJD } from '../src/utils/jdResolver';
import {
  isConfirmationUrl,
  hasVisibleSuccessMessage,
  isSubmitTriggerElement,
} from '../src/utils/submissionWatcher';

describe('Microsoft Forms ATS Tech Stack Support', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Microsoft Forms Field Label Extraction & Number Prefix Cleansing', () => {
    it('extracts question title from span[data-automation-id="questionTitle"] and strips leading number prefix and asterisk', () => {
      document.body.innerHTML = `
        <div class="office-form-question" data-automation-id="questionItem" role="listitem">
          <div class="office-form-question-title-box">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">1. </span>
              <span class="text-format-content">Full Name</span>
              <span class="office-form-question-required" data-automation-id="requiredSymbol" aria-label="Required">*</span>
            </div>
            <div class="office-form-question-sub-title" data-automation-id="questionSubtitle">
              Please enter your legal name.
            </div>
          </div>
          <div class="office-form-question-element">
            <input
              type="text"
              class="office-form-question-textbox"
              data-automation-id="textInput"
              id="q1-input"
            />
          </div>
        </div>
      `;

      const input = document.getElementById('q1-input') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('Full Name');
      expect(classifyField(input, 'Full Name')).toBe('fullName');
    });

    it('extracts textarea screening question prompt in Microsoft Forms', () => {
      document.body.innerHTML = `
        <div class="office-form-question" data-automation-id="questionItem">
          <div class="office-form-question-title" data-automation-id="questionTitle">
            <span class="question-number">4. </span>
            <span class="text-format-content">Why do you want to join our engineering team?</span>
            <span data-automation-id="requiredSymbol">*</span>
          </div>
          <div class="office-form-question-element">
            <textarea
              class="office-form-question-textbox"
              data-automation-id="textInput"
              id="q4-textarea"
            ></textarea>
          </div>
        </div>
      `;

      const textarea = document.getElementById('q4-textarea') as HTMLTextAreaElement;
      expect(findFieldLabel(textarea)).toBe('Why do you want to join our engineering team?');
      expect(classifyField(textarea, findFieldLabel(textarea))).toBe('custom_question');
    });
  });

  describe('Microsoft Forms ChoiceGroup / Radio Button Multiple Choice Detection', () => {
    it('detects Microsoft Forms radio group inside div[data-automation-id="choiceContainer"]', () => {
      document.body.innerHTML = `
        <div class="office-form-question" data-automation-id="questionItem" role="listitem">
          <div class="office-form-question-title" data-automation-id="questionTitle">
            <span class="question-number">2. </span>
            <span class="text-format-content">Are you legally authorized to work in the United States?</span>
            <span data-automation-id="requiredSymbol">*</span>
          </div>
          <div role="radiogroup" data-automation-id="choiceContainer" class="office-form-question-choice">
            <div class="office-form-question-choice-item">
              <label data-automation-id="choiceLabel" class="office-form-question-choice-item-label">
                <input
                  type="radio"
                  name="r_auth"
                  class="office-form-question-choice-radio"
                  value="Yes"
                  id="opt-yes"
                />
                <span class="office-form-question-choice-text">Yes</span>
              </label>
            </div>
            <div class="office-form-question-choice-item">
              <label data-automation-id="choiceLabel" class="office-form-question-choice-item-label">
                <input
                  type="radio"
                  name="r_auth"
                  class="office-form-question-choice-radio"
                  value="No"
                  id="opt-no"
                />
                <span class="office-form-question-choice-text">No</span>
              </label>
            </div>
          </div>
        </div>
      `;

      const { radioGroups } = scanFormFields();
      expect(radioGroups.length).toBe(1);
      expect(radioGroups[0].label).toContain('legally authorized to work');
      expect(radioGroups[0].category).toBe('work_auth');
      expect(radioGroups[0].options.length).toBe(2);
      expect(radioGroups[0].options[0].label).toBe('Yes');
      expect(radioGroups[0].options[0].value).toBe('Yes');
      expect(radioGroups[0].options[1].label).toBe('No');
      expect(radioGroups[0].options[1].value).toBe('No');
    });
  });

  describe('Microsoft Forms Multi-Question Form Scan (Short Answer, Radio, Textarea)', () => {
    it('scans a complete Microsoft Forms application form into standardFields, radioGroups, and customQuestions', () => {
      document.body.innerHTML = `
        <form>
          <!-- 1. Full Name -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">1. </span>
              <span>Name</span>
              <span data-automation-id="requiredSymbol">*</span>
            </div>
            <input type="text" data-automation-id="textInput" class="office-form-question-textbox" id="f-name" />
          </div>

          <!-- 2. Email Address -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">2. </span>
              <span>Email Address</span>
              <span data-automation-id="requiredSymbol">*</span>
            </div>
            <input type="email" data-automation-id="textInput" class="office-form-question-textbox" id="f-email" />
          </div>

          <!-- 3. Contact Number -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">3. </span>
              <span>Contact Number</span>
              <span data-automation-id="requiredSymbol">*</span>
            </div>
            <input type="text" data-automation-id="textInput" class="office-form-question-textbox" id="f-phone" />
          </div>

          <!-- 4. Current Location -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">4. </span>
              <span>Current Location (City, State)</span>
              <span data-automation-id="requiredSymbol">*</span>
            </div>
            <input type="text" data-automation-id="textInput" class="office-form-question-textbox" id="f-city" />
          </div>

          <!-- 5. Visa Sponsorship Radio -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">5. </span>
              <span>Will you now or in the future require visa sponsorship?</span>
              <span data-automation-id="requiredSymbol">*</span>
            </div>
            <div role="radiogroup" data-automation-id="choiceContainer">
              <div class="office-form-question-choice-item">
                <label data-automation-id="choiceLabel">
                  <input type="radio" name="sponsor" value="Yes" />
                  <span class="office-form-question-choice-text">Yes</span>
                </label>
              </div>
              <div class="office-form-question-choice-item">
                <label data-automation-id="choiceLabel">
                  <input type="radio" name="sponsor" value="No" />
                  <span class="office-form-question-choice-text">No</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 6. Custom Screening Question -->
          <div class="office-form-question" data-automation-id="questionItem">
            <div class="office-form-question-title" data-automation-id="questionTitle">
              <span class="question-number">6. </span>
              <span>Describe your relevant experience building web applications:</span>
            </div>
            <textarea data-automation-id="textInput" class="office-form-question-textbox" id="f-exp"></textarea>
          </div>
        </form>
      `;

      const { standardFields, customQuestions, radioGroups } = scanFormFields();
      expect(standardFields.length).toBe(4);
      expect(standardFields[0].label).toBe('Name');
      expect(standardFields[0].type).toBe('fullName');
      expect(standardFields[1].label).toBe('Email Address');
      expect(standardFields[1].type).toBe('email');
      expect(standardFields[2].label).toBe('Contact Number');
      expect(standardFields[2].type).toBe('phone');
      expect(standardFields[3].label).toBe('Current Location (City, State)');
      expect(standardFields[3].type).toBe('city');

      expect(radioGroups.length).toBe(1);
      expect(radioGroups[0].category).toBe('sponsorship');

      expect(customQuestions.length).toBe(1);
      expect(customQuestions[0].label).toBe('Describe your relevant experience building web applications');
      expect(customQuestions[0].type).toBe('custom_question');
    });
  });

  describe('Microsoft Forms Job & Company Metadata Extraction', () => {
    it('extracts job title and company from Microsoft Forms data-automation-id="formTitle" and subtitle', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = {
        hostname: 'forms.office.com',
        pathname: '/Pages/ResponsePage.aspx',
        href: 'https://forms.office.com/Pages/ResponsePage.aspx?id=v4N5cvPz0E...',
      };

      document.title = 'Senior Frontend Engineer at Microsoft - Microsoft Forms';
      document.body.innerHTML = `
        <div class="office-form-header">
          <div class="office-form-title" data-automation-id="formTitle">
            Senior Frontend Engineer at Microsoft
          </div>
          <div class="office-form-subtitle" data-automation-id="formSubtitle">
            Welcome to Microsoft's developer team. Please fill out your details to apply.
          </div>
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Senior Frontend Engineer at Microsoft');
      expect(meta.company).toBe('Microsoft');
      expect(meta.descriptionSnippet).toContain("Welcome to Microsoft's developer team");

      (window as any).location = originalLocation;
    });

    it('extracts company when title format is Prefix - Role (e.g. Acme Corp - Software Intern Application)', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = {
        hostname: 'forms.microsoft.com',
        pathname: '/r/abc123xyz',
        href: 'https://forms.microsoft.com/r/abc123xyz',
      };

      document.title = 'Acme Corp - Software Intern Application - Microsoft Forms';
      document.body.innerHTML = `
        <div class="office-form-title" data-automation-id="formTitle">
          Acme Corp - Software Intern Application
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Acme Corp - Software Intern Application');
      expect(meta.company).toBe('Acme Corp');

      (window as any).location = originalLocation;
    });
  });

  describe('Microsoft Forms Inline Job Description Extraction', () => {
    it('extracts inline JD content from div[data-automation-id="formSubtitle"]', () => {
      document.body.innerHTML = `
        <h1>Frontend Developer</h1>
        <div class="office-form-subtitle" data-automation-id="formSubtitle">
          About the role: We are looking for a skilled Frontend Engineer with experience in React and TypeScript.
          Responsibilities: You will build resilient UI features, collaborate with design teams, and optimize bundle performance.
          Requirements: 3+ years of frontend experience, strong knowledge of JavaScript/TypeScript, and modern web APIs.
          Compensation: $140,000 - $170,000 base salary plus equity and comprehensive benefits.
        </div>
      `;

      const jd = extractInlineJD(document);
      expect(jd).not.toBeNull();
      expect(jd?.source).toBe('inline_dom');
      expect(jd?.jdText).toContain('About the role');
      expect(jd?.jdText).toContain('Responsibilities');
    });
  });

  describe('Microsoft Forms Submission Watching & Auto-Tracking', () => {
    it('recognizes Microsoft Forms submit button via button[data-automation-id="submitButton"]', () => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-automation-id', 'submitButton');
      button.className = 'button-control';
      button.innerHTML = '<span>Submit</span>';
      document.body.appendChild(button);

      expect(isSubmitTriggerElement(button)).toBe(true);

      const span = button.querySelector('span') as HTMLElement;
      expect(isSubmitTriggerElement(span)).toBe(true);
    });

    it('detects Microsoft Forms thank you message via data-automation-id="thankYouMessage"', () => {
      document.body.innerHTML = `
        <div class="office-form-thank-you" data-automation-id="thankYouMessage">
          <div class="office-form-thank-you-title">Thanks!</div>
          <div class="office-form-thank-you-sub-title">Your response was submitted.</div>
          <a data-automation-id="submitAnotherResponseLink" href="#">Submit another response</a>
        </div>
      `;

      expect(hasVisibleSuccessMessage()).toBe(true);
    });
  });
});
