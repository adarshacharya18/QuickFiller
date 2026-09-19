import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findFieldLabel,
  classifyField,
  extractJobMetadata,
  scanFormFields,
} from '../src/utils/scanner';
import { setNativeInputValue } from '../src/utils/autofill';
import {
  isConfirmationUrl,
  hasVisibleSuccessMessage,
} from '../src/utils/submissionWatcher';

describe('Google Forms ATS Tech Stack Support', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Google Forms Field Label Extraction & Asterisk Stripping', () => {
    it('extracts question title from role="heading" inside role="listitem" and strips required asterisk', () => {
      document.body.innerHTML = `
        <div role="listitem" class="Qr7Oae">
          <div class="geS5n">
            <div class="M7eMe" role="heading" aria-level="3" id="i1">
              Full Name
              <span class="vHW8du" aria-label="Required question"> *</span>
            </div>
            <div class="gHqflb" id="i2">Please enter your legal first and last name</div>
            <div class="Xb9hP">
              <input type="text" class="whsOnd zHQkBf" jsname="YPqjbf" id="input-name" aria-labelledby="i1" />
            </div>
          </div>
        </div>
      `;

      const input = document.getElementById('input-name') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('Full Name');
      expect(classifyField(input, 'Full Name')).toBe('fullName');
    });

    it('extracts paragraph question title for custom questions', () => {
      document.body.innerHTML = `
        <div role="listitem" class="Qr7Oae">
          <div class="geS5n">
            <div class="M7eMe" role="heading" aria-level="3" id="i5">
              Why do you want to join our engineering team?
              <span class="vHW8du" aria-label="Required question"> *</span>
            </div>
            <div class="Xb9hP">
              <textarea class="KHxj8b tL9Wh" jsname="YPqjbf" id="q-why" aria-labelledby="i5"></textarea>
            </div>
          </div>
        </div>
      `;

      const textarea = document.getElementById('q-why') as HTMLTextAreaElement;
      expect(findFieldLabel(textarea)).toBe('Why do you want to join our engineering team?');
      expect(classifyField(textarea, findFieldLabel(textarea))).toBe('custom_question');
    });
  });

  describe('Google Forms Radio Button Multiple Choice Detection', () => {
    it('detects Google Forms ARIA radio group with role="radio" and data-value attributes', () => {
      document.body.innerHTML = `
        <div role="listitem" class="Qr7Oae">
          <div class="geS5n">
            <div class="M7eMe" role="heading" aria-level="3">
              Are you legally authorized to work in the United States?
              <span class="vHW8du">*</span>
            </div>
            <div role="radiogroup" aria-label="Are you legally authorized to work in the United States?">
              <div class="docssharedWizToggleLabeledContainer">
                <div class="appsMaterialWizToggleRadiogroupEl" role="radio" aria-checked="false" data-value="Yes" tabindex="0">
                  <div class="quantumWizTogglePaperoperatorRipple"></div>
                </div>
                <label class="docssharedWizToggleLabeledContent">
                  <span class="aDTYNe snByac">Yes</span>
                </label>
              </div>
              <div class="docssharedWizToggleLabeledContainer">
                <div class="appsMaterialWizToggleRadiogroupEl" role="radio" aria-checked="false" data-value="No" tabindex="-1">
                  <div class="quantumWizTogglePaperoperatorRipple"></div>
                </div>
                <label class="docssharedWizToggleLabeledContent">
                  <span class="aDTYNe snByac">No</span>
                </label>
              </div>
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

  describe('Google Forms Floating Label Event Lifecycle (setNativeInputValue)', () => {
    it('dispatches key events and blur to ensure Google Forms floating label elevates', () => {
      const input = document.createElement('input');
      input.className = 'whsOnd zHQkBf';
      document.body.appendChild(input);

      const events: string[] = [];
      input.addEventListener('input', () => events.push('input'));
      input.addEventListener('change', () => events.push('change'));
      input.addEventListener('keydown', () => events.push('keydown'));
      input.addEventListener('keyup', () => events.push('keyup'));
      input.addEventListener('blur', () => events.push('blur'));

      const ok = setNativeInputValue(input, 'Adarsh Acharya', true);
      expect(ok).toBe(true);
      expect(input.value).toBe('Adarsh Acharya');
      expect(events).toContain('input');
      expect(events).toContain('change');
      expect(events).toContain('keydown');
      expect(events).toContain('keyup');
      expect(events).toContain('blur');
    });
  });

  describe('Google Forms Job & Company Metadata Extraction', () => {
    it('extracts company name and job title from Google Forms heading and strips - Google Forms', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = {
        hostname: 'docs.google.com',
        pathname: '/forms/d/e/1FAIpQLSc12345/viewform',
        href: 'https://docs.google.com/forms/d/e/1FAIpQLSc12345/viewform',
      };

      document.title = 'Senior Frontend Engineer at Stripe - Google Forms';
      document.body.innerHTML = `
        <div role="heading" aria-level="1" class="F9NWFb">
          Senior Frontend Engineer at Stripe
        </div>
        <div class="cBGGfd">
          Welcome to Stripe's engineering application. Please provide your details below.
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Senior Frontend Engineer at Stripe');
      expect(meta.company).toBe('Stripe');
      expect(meta.descriptionSnippet).toContain("Welcome to Stripe's engineering application");

      (window as any).location = originalLocation;
    });

    it('extracts company when title format is Prefix - Role (e.g. Acme Corp - Internship Application)', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = {
        hostname: 'docs.google.com',
        pathname: '/forms/d/e/1FAIpQLSc67890/viewform',
        href: 'https://docs.google.com/forms/d/e/1FAIpQLSc67890/viewform',
      };

      document.title = 'Acme Corp - Internship Application - Google Forms';
      document.body.innerHTML = `
        <div role="heading" aria-level="1" class="F9NWFb">
          Acme Corp - Internship Application
        </div>
      `;

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Acme Corp - Internship Application');
      expect(meta.company).toBe('Acme Corp');

      (window as any).location = originalLocation;
    });
  });

  describe('Google Forms Submission Confirmation & Success Message', () => {
    it('recognizes Google Forms /formResponse URL as a confirmation URL', () => {
      expect(
        isConfirmationUrl('https://docs.google.com/forms/d/e/1FAIpQLSc12345/formResponse')
      ).toBe(true);
      expect(
        isConfirmationUrl('https://docs.google.com/forms/u/0/d/e/1FAIpQLSc12345/formResponse')
      ).toBe(true);
    });

    it('detects Google Forms "Your response has been recorded." success message', () => {
      document.body.innerHTML = `
        <div class="freebirdFormviewerViewResponseConfirmationMessage">
          Your response has been recorded.
        </div>
        <div class="freebirdFormviewerViewResponseLinksContainer">
          <a href="#">Submit another response</a>
        </div>
      `;

      expect(hasVisibleSuccessMessage()).toBe(true);
    });
  });

  describe('Google Forms Aria-Labelledby Floating Placeholder ("Your answer") Cleansing', () => {
    it('strips "Your answer" placeholder element from aria-labelledby to return clean field title', () => {
      document.body.innerHTML = `
        <div role="listitem" class="Qr7Oae">
          <div class="geS5n">
            <div class="M7eMe" role="heading" aria-level="3" id="i1">
              Name
              <span class="vHW8du" aria-label="Required question"> *</span>
            </div>
            <div class="Xb9hP">
              <input type="text" class="whsOnd zHQkBf" jsname="YPqjbf" id="q-name" name="entry.1001" aria-labelledby="i1 i4" />
              <div id="i4" class="c2gzEf">Your answer</div>
            </div>
          </div>
        </div>
      `;

      const input = document.getElementById('q-name') as HTMLInputElement;
      expect(findFieldLabel(input)).toBe('Name');
      expect(classifyField(input, 'Name')).toBe('fullName');
    });

    it('classifies Google Forms fields with common phrasing into standard fields', () => {
      const createGFormInput = (label: string, name: string = 'entry.123', type: string = 'text') => {
        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.className = 'whsOnd zHQkBf';
        return { input, classification: classifyField(input, label) };
      };

      expect(createGFormInput('Name').classification).toBe('fullName');
      expect(createGFormInput('Your Name').classification).toBe('fullName');
      expect(createGFormInput('Full Name').classification).toBe('fullName');
      expect(createGFormInput('What is your full name?').classification).toBe('fullName');

      expect(createGFormInput('Email Address').classification).toBe('email');
      expect(createGFormInput('What is your email address?').classification).toBe('email');

      expect(createGFormInput('Phone Number').classification).toBe('phone');
      expect(createGFormInput('Contact Number').classification).toBe('phone');
      expect(createGFormInput('Contact No.').classification).toBe('phone');
      expect(createGFormInput('WhatsApp Number').classification).toBe('phone');

      expect(createGFormInput('LinkedIn Profile').classification).toBe('linkedin');
      expect(createGFormInput('GitHub Profile URL').classification).toBe('github');
      expect(createGFormInput('Portfolio Link').classification).toBe('portfolio');

      expect(createGFormInput('Current Location').classification).toBe('city');
      expect(createGFormInput('Current Location (City, State)').classification).toBe('city');
      expect(createGFormInput('PIN Code').classification).toBe('postalCode');
      expect(createGFormInput('Postal Code').classification).toBe('postalCode');

      // Screening questions properly preserved as custom_question
      expect(createGFormInput('Why do you want to join our team?').classification).toBe('custom_question');
      expect(createGFormInput('What is your notice period in days?').classification).toBe('custom_question');
      expect(createGFormInput('Company Name').classification).toBe('custom_question');
      expect(createGFormInput('College / University Name').classification).toBe('custom_question');
    });

    it('scans a multi-question Google Form and populates both standardFields and customQuestions', () => {
      document.body.innerHTML = `
        <form action="/formResponse" method="POST">
          <!-- Question 1: Name -->
          <div role="listitem" class="Qr7Oae">
            <div class="geS5n">
              <div class="M7eMe" role="heading" aria-level="3" id="i1">Name *</div>
              <div class="Xb9hP">
                <input type="text" class="whsOnd zHQkBf" name="entry.101" id="f-name" aria-labelledby="i1 i4" />
                <div id="i4" class="c2gzEf">Your answer</div>
              </div>
            </div>
          </div>

          <!-- Question 2: Email -->
          <div role="listitem" class="Qr7Oae">
            <div class="geS5n">
              <div class="M7eMe" role="heading" aria-level="3" id="i5">Email Address *</div>
              <div class="Xb9hP">
                <input type="email" class="whsOnd zHQkBf" name="entry.102" id="f-email" aria-labelledby="i5 i8" />
                <div id="i8" class="c2gzEf">Your answer</div>
              </div>
            </div>
          </div>

          <!-- Question 3: Contact Number -->
          <div role="listitem" class="Qr7Oae">
            <div class="geS5n">
              <div class="M7eMe" role="heading" aria-level="3" id="i9">Contact Number *</div>
              <div class="Xb9hP">
                <input type="text" class="whsOnd zHQkBf" name="entry.103" id="f-phone" aria-labelledby="i9 i12" />
                <div id="i12" class="c2gzEf">Your answer</div>
              </div>
            </div>
          </div>

          <!-- Question 4: Screening custom textarea -->
          <div role="listitem" class="Qr7Oae">
            <div class="geS5n">
              <div class="M7eMe" role="heading" aria-level="3" id="i13">Why are you interested in this position? *</div>
              <div class="Xb9hP">
                <textarea class="KHxj8b tL9Wh" name="entry.104" id="f-why" aria-labelledby="i13 i16"></textarea>
                <div id="i16" class="c2gzEf">Your answer</div>
              </div>
            </div>
          </div>
        </form>
      `;

      const { standardFields, customQuestions } = scanFormFields();
      expect(standardFields.length).toBe(3);
      expect(customQuestions.length).toBe(1);

      expect(standardFields.map((f) => f.type)).toEqual(['fullName', 'email', 'phone']);
      expect(standardFields[0].label).toBe('Name');
      expect(standardFields[1].label).toBe('Email Address');
      expect(standardFields[2].label).toBe('Contact Number');

      expect(customQuestions[0].label).toBe('Why are you interested in this position?');
      expect(customQuestions[0].type).toBe('custom_question');
    });
  });
});
