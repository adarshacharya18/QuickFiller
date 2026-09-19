import { describe, it, expect, beforeEach } from 'vitest';
import { scanFormFields } from '../src/utils/scanner';
import {
  matchOptionPolarity,
  resolveRadioOption,
  classifyRadioGroup,
  DetectedRadioGroup,
} from '../src/utils/radioResolver';
import { setNativeRadioChecked } from '../src/utils/autofill';
import { defaultWizardAnswers } from '../src/types/questions';

describe('Radio Button Autofill Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Radio Group Discovery & Label Extraction', () => {
    it('discovers standard HTML5 fieldset with legend and radio options', () => {
      document.body.innerHTML = `
        <fieldset>
          <legend>Are you legally authorized to work in the United States?</legend>
          <div>
            <input type="radio" id="auth-yes" name="authorized" value="yes" />
            <label for="auth-yes">Yes</label>
          </div>
          <div>
            <input type="radio" id="auth-no" name="authorized" value="no" />
            <label for="auth-no">No</label>
          </div>
        </fieldset>
      `;

      const { radioGroups } = scanFormFields();
      expect(radioGroups.length).toBe(1);
      expect(radioGroups[0].label).toContain('legally authorized to work');
      expect(radioGroups[0].category).toBe('work_auth');
      expect(radioGroups[0].options.length).toBe(2);
      expect(radioGroups[0].options[0].label).toBe('Yes');
      expect(radioGroups[0].options[0].value).toBe('yes');
      expect(radioGroups[0].options[1].label).toBe('No');
      expect(radioGroups[0].options[1].value).toBe('no');
    });

    it('discovers Workday ARIA radiogroup with automation IDs', () => {
      document.body.innerHTML = `
        <div data-automation-id="formField-sponsorshipPrompt" role="radiogroup">
          <div data-automation-id="formLabel">
            Will you now or in the future require visa sponsorship?*
          </div>
          <div>
            <label>
              <input type="radio" name="wd-sponsor" value="yes" />
              Yes
            </label>
            <label>
              <input type="radio" name="wd-sponsor" value="no" />
              No
            </label>
          </div>
        </div>
      `;

      const { radioGroups } = scanFormFields();
      expect(radioGroups.length).toBe(1);
      expect(radioGroups[0].label).toContain('require visa sponsorship');
      expect(radioGroups[0].category).toBe('sponsorship');
      expect(radioGroups[0].options.length).toBe(2);
    });

    it('excludes radio buttons inside quickfiller-drawer UI', () => {
      // Form radio
      const formDiv = document.createElement('div');
      formDiv.innerHTML = `
        <fieldset>
          <legend>Are you willing to relocate?</legend>
          <label><input type="radio" name="relocate" value="yes" /> Yes</label>
          <label><input type="radio" name="relocate" value="no" /> No</label>
        </fieldset>
      `;
      document.body.appendChild(formDiv);

      // Drawer internal radio UI
      const drawer = document.createElement('quickfiller-drawer');
      const shadow = drawer.attachShadow({ mode: 'open' });
      const internalUi = document.createElement('div');
      internalUi.setAttribute('data-quickfiller-ui', 'true');
      internalUi.innerHTML = `
        <input type="radio" name="drawer-internal-opt" value="1" />
        <input type="radio" name="drawer-internal-opt" value="2" />
      `;
      shadow.appendChild(internalUi);
      document.body.appendChild(drawer);

      const { radioGroups } = scanFormFields();
      expect(radioGroups.length).toBe(1);
      expect(radioGroups[0].label).toContain('relocate');
    });
  });

  describe('Classification & Polarity Matching', () => {
    it('classifies standard categories accurately', () => {
      expect(classifyRadioGroup('Are you authorized to work in the US?')).toBe('work_auth');
      expect(classifyRadioGroup('Will you require employment sponsorship?')).toBe('sponsorship');
      expect(classifyRadioGroup('Are you willing to relocate to Seattle?')).toBe('relocation');
      expect(classifyRadioGroup('Please disclose your protected veteran status')).toBe('veteran');
      expect(classifyRadioGroup('Voluntary Self-Identification of Disability')).toBe('disability');
      expect(classifyRadioGroup('Please indicate your gender identity')).toBe('gender');
      expect(classifyRadioGroup('Do you have experience with Kubernetes?')).toBe('custom');
    });

    it('matches affirmative and negative polarity across diverse option texts and values', () => {
      // Affirmative
      expect(matchOptionPolarity('Yes', 'yes', 'YES')).toBe(true);
      expect(matchOptionPolarity('Yes, I am authorized', '1', 'YES')).toBe(true);
      expect(matchOptionPolarity('Eligible to work', 'true', 'YES')).toBe(true);
      expect(matchOptionPolarity('No', 'no', 'YES')).toBe(false);

      // Negative
      expect(matchOptionPolarity('No', 'no', 'NO')).toBe(true);
      expect(matchOptionPolarity('I do not require sponsorship', '0', 'NO')).toBe(true);
      expect(matchOptionPolarity('Will not require visa', 'false', 'NO')).toBe(true);
      expect(matchOptionPolarity('Yes', 'yes', 'NO')).toBe(false);
    });
  });

  describe('Candidate Option Resolution (resolveRadioOption)', () => {
    it('resolves Work Authorization affirmative option', () => {
      const yesInput = document.createElement('input');
      yesInput.type = 'radio';
      const noInput = document.createElement('input');
      noInput.type = 'radio';

      const group: DetectedRadioGroup = {
        id: 'group_auth',
        name: 'authorized',
        label: 'Are you legally authorized to work in target country?',
        category: 'work_auth',
        options: [
          { id: 'opt_yes', value: 'yes', label: 'Yes, I am authorized', element: yesInput, isChecked: false },
          { id: 'opt_no', value: 'no', label: 'No', element: noInput, isChecked: false },
        ],
      };

      const resolved = resolveRadioOption(group, {
        ...defaultWizardAnswers,
        authorizedToWork: 'Yes',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe('opt_yes');
    });

    it('resolves Sponsorship negative option when candidate requires no sponsorship', () => {
      const yesInput = document.createElement('input');
      yesInput.type = 'radio';
      const noInput = document.createElement('input');
      noInput.type = 'radio';

      const group: DetectedRadioGroup = {
        id: 'group_spons',
        name: 'sponsorship',
        label: 'Will you now or in the future require visa sponsorship?',
        category: 'sponsorship',
        options: [
          { id: 'opt_y', value: 'yes', label: 'Yes', element: yesInput, isChecked: false },
          { id: 'opt_n', value: 'no', label: 'No, I will not require sponsorship', element: noInput, isChecked: false },
        ],
      };

      const resolved = resolveRadioOption(group, {
        ...defaultWizardAnswers,
        requireSponsorship: 'No',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe('opt_n');
    });

    it('resolves Veteran status when candidate is not a protected veteran', () => {
      const opt1 = document.createElement('input');
      const opt2 = document.createElement('input');
      const opt3 = document.createElement('input');

      const group: DetectedRadioGroup = {
        id: 'group_vet',
        name: 'veteran',
        label: 'Veteran Status (EEO)',
        category: 'veteran',
        options: [
          { id: 'v1', value: 'vet', label: 'I identify as a protected veteran', element: opt1, isChecked: false },
          { id: 'v2', value: 'not_vet', label: 'I am not a protected veteran', element: opt2, isChecked: false },
          { id: 'v3', value: 'decline', label: 'I do not wish to answer', element: opt3, isChecked: false },
        ],
      };

      const resolved = resolveRadioOption(group, {
        ...defaultWizardAnswers,
        veteranStatus: 'Not a veteran',
      });

      expect(resolved?.id).toBe('v2');
    });
  });

  describe('Native Radio Event Dispatch (setNativeRadioChecked)', () => {
    it('sets input.checked to true and dispatches composed click and change events', () => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'test-radio-group';
      radio.value = 'yes';
      document.body.appendChild(radio);

      let clicked = false;
      let changed = false;

      radio.addEventListener('click', (e) => {
        expect(e.composed).toBe(true);
        clicked = true;
      });
      radio.addEventListener('change', (e) => {
        expect(e.composed).toBe(true);
        changed = true;
      });

      const ok = setNativeRadioChecked(radio);
      expect(ok).toBe(true);
      expect(radio.checked).toBe(true);
      expect(clicked).toBe(true);
      expect(changed).toBe(true);
    });

    it('sets ARIA radio element aria-checked="true" and dispatches click', () => {
      const ariaRadio = document.createElement('div');
      ariaRadio.setAttribute('role', 'radio');
      ariaRadio.setAttribute('aria-checked', 'false');
      ariaRadio.setAttribute('data-value', 'Yes');
      document.body.appendChild(ariaRadio);

      let clicked = false;
      ariaRadio.addEventListener('click', () => {
        clicked = true;
      });

      const ok = setNativeRadioChecked(ariaRadio);
      expect(ok).toBe(true);
      expect(ariaRadio.getAttribute('aria-checked')).toBe('true');
      expect(clicked).toBe(true);
    });
  });
});
