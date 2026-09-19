import { describe, it, expect, beforeEach } from 'vitest';
import { setNativeInputValue, insertTextAtCursor } from '../src/utils/autofill';

describe('Autofill & Text Insertion Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Native Input Value Setting (setNativeInputValue)', () => {
    it('sets input value and dispatches composed input and change events', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const events: string[] = [];
      input.addEventListener('input', (e) => {
        expect(e.composed).toBe(true);
        events.push('input');
      });
      input.addEventListener('change', (e) => {
        expect(e.composed).toBe(true);
        events.push('change');
      });

      const success = setNativeInputValue(input, 'Adarsh Acharya');
      expect(success).toBe(true);
      expect(input.value).toBe('Adarsh Acharya');
      expect(events).toContain('input');
      expect(events).toContain('change');
    });

    it('synchronizes value to Shadow DOM Web Component host (Darwinbox Stencil)', () => {
      const host = document.createElement('dbx-ds-text-input') as any;
      host.value = '';
      const shadow = host.attachShadow({ mode: 'open' });
      const innerInput = document.createElement('input');
      shadow.appendChild(innerInput);
      document.body.appendChild(host);

      let customEventFired = false;
      host.addEventListener('dbxInput', (e: any) => {
        expect(e.detail.value).toBe('Bangalore');
        customEventFired = true;
      });

      const success = setNativeInputValue(innerInput, 'Bangalore');
      expect(success).toBe(true);
      expect(innerInput.value).toBe('Bangalore');
      expect(host.value).toBe('Bangalore');
      expect(customEventFired).toBe(true);
    });
  });

  describe('Caret & Selection Text Insertion (insertTextAtCursor)', () => {
    it('inserts text at caret position in textarea', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'Hello ';
      textarea.selectionStart = 6;
      textarea.selectionEnd = 6;
      document.body.appendChild(textarea);

      const success = insertTextAtCursor('World', textarea);
      expect(success).toBe(true);
      expect(textarea.value).toBe('Hello World');
    });

    it('replaces active selection when inserting', () => {
      const input = document.createElement('input');
      input.value = 'Hello Old World';
      input.selectionStart = 6;
      input.selectionEnd = 9; // select "Old"
      document.body.appendChild(input);

      const success = insertTextAtCursor('New', input);
      expect(success).toBe(true);
      expect(input.value).toBe('Hello New World');
    });

    it('drills down into focused element inside open ShadowRoot', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const innerTextarea = document.createElement('textarea');
      innerTextarea.value = 'Draft: ';
      innerTextarea.selectionStart = 7;
      innerTextarea.selectionEnd = 7;
      shadow.appendChild(innerTextarea);
      document.body.appendChild(host);

      // Focus inner textarea
      innerTextarea.focus();

      const success = insertTextAtCursor('Tailored Cover Letter', innerTextarea);
      expect(success).toBe(true);
      expect(innerTextarea.value).toBe('Draft: Tailored Cover Letter');
    });

    it('inserts text into LinkedIn message popup contenteditable element', () => {
      const msgForm = document.createElement('form');
      msgForm.className = 'msg-form';

      const editableDiv = document.createElement('div');
      editableDiv.className = 'msg-form__contenteditable';
      editableDiv.setAttribute('contenteditable', 'true');
      editableDiv.setAttribute('role', 'textbox');
      editableDiv.setAttribute('aria-label', 'Write a message…');
      editableDiv.innerHTML = '<p class="msg-form__placeholder">Write a message...</p><p><br></p>';

      msgForm.appendChild(editableDiv);
      document.body.appendChild(msgForm);

      // Mock layout visibility
      Object.defineProperty(editableDiv, 'offsetWidth', { value: 300, configurable: true });
      Object.defineProperty(editableDiv, 'offsetHeight', { value: 100, configurable: true });

      const events: string[] = [];
      editableDiv.addEventListener('input', () => events.push('input'));
      editableDiv.addEventListener('change', () => events.push('change'));
      editableDiv.addEventListener('keyup', () => events.push('keyup'));

      const success = insertTextAtCursor('Hi Sarah, loved your work on distributed systems!', editableDiv);
      expect(success).toBe(true);
      expect(editableDiv.textContent).toContain('Hi Sarah, loved your work on distributed systems!');
      expect(events).toContain('input');
      expect(events).toContain('change');
      expect(events).toContain('keyup');
    });

    it('auto-discovers visible LinkedIn message box when no targetInfo is provided', () => {
      const editableDiv = document.createElement('div');
      editableDiv.className = 'msg-form__contenteditable';
      editableDiv.setAttribute('contenteditable', 'true');
      editableDiv.setAttribute('role', 'textbox');
      editableDiv.innerHTML = '<p><br></p>';
      document.body.appendChild(editableDiv);

      Object.defineProperty(editableDiv, 'offsetWidth', { value: 300, configurable: true });
      Object.defineProperty(editableDiv, 'offsetHeight', { value: 100, configurable: true });

      // No targetInfo passed, activeElement is on body
      const success = insertTextAtCursor('Connecting about the backend role');
      expect(success).toBe(true);
      expect(editableDiv.textContent).toContain('Connecting about the backend role');
    });
  });
});
