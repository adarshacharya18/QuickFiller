import { describe, it, expect, beforeEach } from 'vitest';
import {
  querySelectorAllDeep,
  findFieldLabel,
  classifyField,
  extractJobMetadata,
  getCleanFormatHint,
  scanFormFields,
} from '../src/utils/scanner';

describe('Scanner & Field Identification', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Deep Shadow DOM Traversal (querySelectorAllDeep)', () => {
    it('discovers elements nested inside open shadow roots', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      innerInput.name = 'firstName';
      shadow.appendChild(innerInput);
      document.body.appendChild(host);

      const found = querySelectorAllDeep<HTMLInputElement>('input', document);
      expect(found.length).toBe(1);
      expect(found[0]).toBe(innerInput);
    });

    it('traverses multi-level nested shadow roots', () => {
      const outerHost = document.createElement('div');
      const outerShadow = outerHost.attachShadow({ mode: 'open' });
      const innerHost = document.createElement('div');
      const innerShadow = innerHost.attachShadow({ mode: 'open' });
      const deepInput = document.createElement('input');
      deepInput.type = 'email';

      innerShadow.appendChild(deepInput);
      outerShadow.appendChild(innerHost);
      document.body.appendChild(outerHost);

      const found = querySelectorAllDeep<HTMLInputElement>('input', document);
      expect(found.length).toBe(1);
      expect(found[0]).toBe(deepInput);
    });
  });

  describe('Field Label Resolution (findFieldLabel)', () => {
    it('resolves explicit label[for] in document', () => {
      document.body.innerHTML = `
        <label for="f-name">First Name</label>
        <input id="f-name" />
      `;
      const input = document.getElementById('f-name') as HTMLElement;
      expect(findFieldLabel(input)).toBe('First Name');
    });

    it('resolves wrapping parent label', () => {
      document.body.innerHTML = `
        <label>
          Last Name
          <input id="l-name" />
        </label>
      `;
      const input = document.getElementById('l-name') as HTMLElement;
      expect(findFieldLabel(input)).toBe('Last Name');
    });

    it('resolves aria-label and aria-labelledby', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Phone Number');
      expect(findFieldLabel(input)).toBe('Phone Number');
    });

    it('resolves Web Component host label attribute (Darwinbox Stencil)', () => {
      const host = document.createElement('dbx-ds-text-input');
      host.setAttribute('label', 'LinkedIn Profile');
      const shadow = host.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      shadow.appendChild(innerInput);
      document.body.appendChild(host);

      expect(findFieldLabel(innerInput)).toBe('LinkedIn Profile');
    });

    it('resolves host parent container (dbx-ds-form-field)', () => {
      const formField = document.createElement('dbx-ds-form-field');
      formField.setAttribute('label', 'Current City');

      const textInput = document.createElement('dbx-ds-text-input');
      const shadow = textInput.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      shadow.appendChild(innerInput);

      formField.appendChild(textInput);
      document.body.appendChild(formField);

      expect(findFieldLabel(innerInput)).toBe('Current City');
    });
  });

  describe('Field Classification (classifyField)', () => {
    it('classifies standard profile fields accurately', () => {
      const createInput = (attrs: Record<string, string>, tag: string = 'input') => {
        const el = document.createElement(tag) as HTMLInputElement;
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
      };

      expect(classifyField(createInput({ name: 'first_name' }), 'First Name')).toBe('firstName');
      expect(classifyField(createInput({ name: 'lastName' }), 'Last Name')).toBe('lastName');
      expect(classifyField(createInput({ name: 'candidate_name' }), 'Full Name')).toBe('fullName');
      expect(classifyField(createInput({ type: 'email' }), 'Email')).toBe('email');
      expect(classifyField(createInput({ type: 'tel' }), 'Phone Number')).toBe('phone');
      expect(classifyField(createInput({ placeholder: 'https://linkedin.com/in/...' }), 'LinkedIn')).toBe('linkedin');
      expect(classifyField(createInput({ name: 'github_url' }), 'GitHub')).toBe('github');
      expect(classifyField(createInput({ name: 'portfolio' }), 'Personal Website')).toBe('portfolio');
      expect(classifyField(createInput({ name: 'city' }), 'City')).toBe('city');
      expect(classifyField(createInput({ name: 'state' }), 'State')).toBe('state');
      expect(classifyField(createInput({ name: 'zip' }), 'Postal Code')).toBe('postalCode');
    });

    it('classifies fields using Angular formControlName and host attributes', () => {
      const host = document.createElement('dbx-ds-text-input');
      host.setAttribute('formcontrolname', 'firstName');
      host.setAttribute('label', 'First Name');
      const shadow = host.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      shadow.appendChild(innerInput);
      document.body.appendChild(host);

      expect(classifyField(innerInput, 'First Name')).toBe('firstName');
    });

    it('distinguishes Cover Letter from custom questions', () => {
      const textarea = document.createElement('textarea');
      expect(classifyField(textarea, 'Cover Letter')).toBe('cover_letter');
      expect(classifyField(textarea, 'Motivation Letter')).toBe('cover_letter');
      expect(classifyField(textarea, 'Why are you a good fit for this role?')).toBe('custom_question');
    });
  });

  describe('Job & Company Metadata Extraction (extractJobMetadata)', () => {
    it('extracts Darwinbox company name by stripping hrms from subdomain', () => {
      // Mock Darwinbox window location
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = new URL('https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/applications/123');

      document.body.innerHTML = `
        <h1>Senior Frontend Engineer</h1>
      `;

      const meta = extractJobMetadata();
      expect(meta.company).toBe('Leadsquared');
      expect(meta.title).toBe('Senior Frontend Engineer');

      window.location = originalLocation;
    });

    it('parses pipe and dash job titles cleanly', () => {
      const originalTitle = document.title;
      document.title = 'Staff Software Engineer | Acme Corp';

      const meta = extractJobMetadata();
      expect(meta.title).toBe('Staff Software Engineer');

      document.title = originalTitle;
    });
  });

  describe('Format Hint Extraction (getCleanFormatHint)', () => {
    it('cleans trailing ellipsis from format hints', () => {
      expect(getCleanFormatHint('e.g. $140,000, 2 weeks notice...')).toBe('e.g. $140,000, 2 weeks notice');
      expect(getCleanFormatHint('e.g. 5 years…')).toBe('e.g. 5 years');
    });

    it('filters out generic non-informative placeholders', () => {
      expect(getCleanFormatHint('type here...')).toBeNull();
      expect(getCleanFormatHint('enter your response')).toBeNull();
      expect(getCleanFormatHint('describe your experience...')).toBeNull();
      expect(getCleanFormatHint('...')).toBeNull();
      expect(getCleanFormatHint('---')).toBeNull();
    });

    it('preserves informative format examples', () => {
      expect(getCleanFormatHint('e.g. John Doe')).toBe('e.g. John Doe');
      expect(getCleanFormatHint('https://linkedin.com/in/username')).toBe('https://linkedin.com/in/username');
      expect(getCleanFormatHint('MM/DD/YYYY')).toBe('MM/DD/YYYY');
    });
  });
});
