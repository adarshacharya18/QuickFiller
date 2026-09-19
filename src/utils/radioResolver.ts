import { ScreeningWizardAnswers, ScreeningQuestion } from '../types/questions';

export type RadioGroupCategory =
  | 'work_auth'
  | 'sponsorship'
  | 'relocation'
  | 'veteran'
  | 'disability'
  | 'gender'
  | 'custom';

export interface RadioOption {
  id: string;
  value: string;
  label: string;
  element: HTMLElement; // Can be HTMLInputElement or ARIA role="radio" div
  isChecked: boolean;
}

export interface DetectedRadioGroup {
  id: string;
  name: string;
  label: string; // The overarching question prompt (e.g. "Are you legally authorized to work in the US?")
  category: RadioGroupCategory;
  options: RadioOption[];
  containerElement?: HTMLElement;
}

/**
 * Classifies a radio button group based on its question label, name, and container metadata.
 */
export function classifyRadioGroup(
  label: string,
  name: string = '',
  containerAttrs: string = ''
): RadioGroupCategory {
  const text = `${label} ${name} ${containerAttrs}`.toLowerCase();

  if (
    /sponsorship|sponsor|\bvisa\b|require.*sponsorship|sponsorship.*require|work.*permit|h-?1b/i.test(
      text
    )
  ) {
    return 'sponsorship';
  }

  if (
    /authorized.*(work|employ)|legally.*(authorized|eligible)|eligib.*(work|employ)|work.*authoriz|right.*to.*work|citizenship|authorized.*in/i.test(
      text
    )
  ) {
    return 'work_auth';
  }

  if (/relocat|willing.*to.*move|open.*to.*relocat/i.test(text)) {
    return 'relocation';
  }

  if (/veteran|military|armed.*forces/i.test(text)) {
    return 'veteran';
  }

  if (/disabilit|handicap|physical.*impairment|mental.*impairment/i.test(text)) {
    return 'disability';
  }

  if (/\bgender\b|\bsex\b|pronoun/i.test(text) && !/transgender/i.test(text)) {
    return 'gender';
  }

  return 'custom';
}

/**
 * Evaluates whether an option's text or value matches an affirmative (YES) or negative (NO) polarity.
 */
export function matchOptionPolarity(
  optionLabel: string,
  optionValue: string,
  desiredPolarity: 'YES' | 'NO'
): boolean {
  const normLabel = (optionLabel || '').trim().toLowerCase();
  const normVal = (optionValue || '').trim().toLowerCase();
  const combined = `${normLabel} ${normVal}`.trim();

  const isExplicitNo =
    /^(no|n|false|0|unauthorized|unwilling|not eligible)$/i.test(normVal) ||
    /^(no|n|false|0)$/i.test(normLabel) ||
    /^(no\b|i am not\b|i do not\b|will not\b|cannot\b|not authorized|not willing|not eligible)/i.test(
      normLabel
    ) ||
    /\b(will not require|do not require|no sponsorship|not require)\b/i.test(combined);

  const isExplicitYes =
    /^(yes|y|true|1|authorized|willing|eligible)$/i.test(normVal) ||
    /^(yes|y|true|1)$/i.test(normLabel) ||
    /^(yes\b|i am\b|i do\b|will\b|authorized|willing|eligible|i will)/i.test(normLabel) ||
    /\b(will require|require sponsorship)\b/i.test(combined);

  if (desiredPolarity === 'YES') {
    if (isExplicitNo) return false;
    return isExplicitYes || /^(yes|true|1|y)$/i.test(normVal);
  } else {
    // desiredPolarity === 'NO'
    if (isExplicitYes && !isExplicitNo) return false;
    return isExplicitNo || /^(no|false|0|n)$/i.test(normVal);
  }
}

/**
 * Resolves the optimal RadioOption for a DetectedRadioGroup based on Candidate Wizard Answers and Question Bank.
 */
export function resolveRadioOption(
  group: DetectedRadioGroup,
  wizardAnswers?: ScreeningWizardAnswers,
  questionBank?: ScreeningQuestion[]
): RadioOption | null {
  if (!group || !group.options || group.options.length === 0) {
    return null;
  }

  const { category, options } = group;

  // 1. Work Authorization
  if (category === 'work_auth' && wizardAnswers?.authorizedToWork) {
    const desired = wizardAnswers.authorizedToWork.toUpperCase() === 'NO' ? 'NO' : 'YES';
    const match = options.find((opt) => matchOptionPolarity(opt.label, opt.value, desired));
    if (match) return match;
  }

  // 2. Visa Sponsorship
  if (category === 'sponsorship' && wizardAnswers?.requireSponsorship) {
    // Does the candidate require sponsorship? (Default: "No")
    const desired = wizardAnswers.requireSponsorship.toUpperCase() === 'YES' ? 'YES' : 'NO';
    const match = options.find((opt) => matchOptionPolarity(opt.label, opt.value, desired));
    if (match) return match;
  }

  // 3. Relocation
  if (category === 'relocation' && wizardAnswers?.openToRelocation) {
    const relocPref = wizardAnswers.openToRelocation.toLowerCase();
    if (relocPref === 'remote only') {
      const remoteOpt = options.find((opt) =>
        /remote/i.test(`${opt.label} ${opt.value}`)
      );
      if (remoteOpt) return remoteOpt;
      // Fallback: if only Yes/No exists, remote only is usually No to physical relocation
      const noOpt = options.find((opt) => matchOptionPolarity(opt.label, opt.value, 'NO'));
      if (noOpt) return noOpt;
    } else {
      const desired = relocPref === 'yes' ? 'YES' : 'NO';
      const match = options.find((opt) => matchOptionPolarity(opt.label, opt.value, desired));
      if (match) return match;
    }
  }

  // 4. Veteran Status
  if (category === 'veteran' && wizardAnswers?.veteranStatus) {
    const target = wizardAnswers.veteranStatus.toLowerCase();
    if (/prefer not|decline|wish not/i.test(target)) {
      const opt = options.find((o) =>
        /prefer not|decline|wish not|choose not/i.test(`${o.label} ${o.value}`)
      );
      if (opt) return opt;
    } else if (/not a veteran|not/i.test(target)) {
      const opt = options.find(
        (o) =>
          /not a veteran|not a protected|not in|i am not|i'm not/i.test(`${o.label} ${o.value}`) ||
          /^(no|0|false)$/i.test(o.value) ||
          /^no$/i.test(o.label)
      );
      if (opt) return opt;
    } else {
      // Is veteran
      const opt = options.find(
        (o) =>
          /identify as|protected veteran|i am a veteran|active duty/i.test(`${o.label} ${o.value}`) ||
          /^(yes|1|true)$/i.test(o.value) ||
          /^yes$/i.test(o.label)
      );
      if (opt) return opt;
    }
  }

  // 5. Disability Status
  if (category === 'disability' && wizardAnswers?.disabilityStatus) {
    const target = wizardAnswers.disabilityStatus.toLowerCase();
    if (/prefer not|decline|wish not/i.test(target)) {
      const opt = options.find((o) =>
        /prefer not|decline|wish not|choose not/i.test(`${o.label} ${o.value}`)
      );
      if (opt) return opt;
    } else if (/no|not/i.test(target)) {
      const opt = options.find(
        (o) =>
          /do not have|no disability|i don't have|not have/i.test(`${o.label} ${o.value}`) ||
          /^(no|0|false)$/i.test(o.value) ||
          /^no$/i.test(o.label)
      );
      if (opt) return opt;
    } else {
      const opt = options.find(
        (o) =>
          /yes.*disability|have a disability|i have/i.test(`${o.label} ${o.value}`) ||
          /^(yes|1|true)$/i.test(o.value) ||
          /^yes$/i.test(o.label)
      );
      if (opt) return opt;
    }
  }

  // 6. Gender
  if (category === 'gender' && wizardAnswers?.gender) {
    const target = wizardAnswers.gender.toLowerCase();
    if (/prefer not|decline|wish not/i.test(target)) {
      const opt = options.find((o) =>
        /prefer not|decline|wish not|choose not/i.test(`${o.label} ${o.value}`)
      );
      if (opt) return opt;
    } else if (target === 'female') {
      const opt = options.find((o) => /\bfemale\b/i.test(`${o.label} ${o.value}`));
      if (opt) return opt;
    } else if (target === 'male') {
      const opt = options.find(
        (o) => /\bmale\b/i.test(`${o.label} ${o.value}`) && !/female/i.test(`${o.label} ${o.value}`)
      );
      if (opt) return opt;
    } else if (/non-binary|nonbinary/i.test(target)) {
      const opt = options.find((o) => /non-?binary/i.test(`${o.label} ${o.value}`));
      if (opt) return opt;
    }
  }

  // 7. Custom / Question Bank matching
  if (questionBank && questionBank.length > 0) {
    const groupNorm = group.label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    for (const q of questionBank) {
      const qNorm = q.questionPrompt.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
      if (
        groupNorm.includes(qNorm) ||
        qNorm.includes(groupNorm) ||
        (qNorm.length > 10 && groupNorm.slice(0, 20) === qNorm.slice(0, 20))
      ) {
        const targetAns = q.answer.toLowerCase().trim();
        // Look for option that matches the answer
        const opt = options.find((o) => {
          const optText = `${o.label} ${o.value}`.toLowerCase().trim();
          return (
            optText === targetAns ||
            optText.includes(targetAns) ||
            targetAns.includes(optText)
          );
        });
        if (opt) return opt;
      }
    }
  }

  // 8. Universal binary Yes/No fallback for standard positive questions (e.g. "Are you 18 or older?")
  if (
    /18|eighteen|age|felony|background.*check/i.test(group.label)
  ) {
    const isOver18 = /18|eighteen|age/i.test(group.label);
    const desired = isOver18 ? 'YES' : 'NO';
    const match = options.find((opt) => matchOptionPolarity(opt.label, opt.value, desired));
    if (match) return match;
  }

  return null;
}
