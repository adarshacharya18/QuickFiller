export type StandardFieldType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'city';

export interface DetectedField {
  id: string;
  element: HTMLInputElement | HTMLTextAreaElement;
  type: StandardFieldType | 'custom_question';
  label: string;
  placeholder: string;
  value: string;
  isTextarea: boolean;
}

export interface JobMetadata {
  title: string;
  company: string;
  descriptionSnippet: string;
}

export function findFieldLabel(element: HTMLElement): string {
  // 1. Explicit <label for="...">
  if (element.id) {
    const labelElem = document.querySelector(`label[for="${element.id}"]`);
    if (labelElem && labelElem.textContent?.trim()) {
      return labelElem.textContent.trim();
    }
  }

  // 2. Wrapping <label>
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent?.trim()) {
    // Clone and remove inputs to get just label text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select').forEach((n) => n.remove());
    if (clone.textContent?.trim()) {
      return clone.textContent.trim();
    }
  }

  // 3. ARIA attributes
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label')!.trim();
  }
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const refElem = document.getElementById(ariaLabelledBy);
    if (refElem && refElem.textContent?.trim()) {
      return refElem.textContent.trim();
    }
  }

  // 4. Preceding text or parent container headers
  const parentContainer = element.closest('.form-group, .field, [class*="field"], [class*="question"], div');
  if (parentContainer) {
    const headerOrLegend = parentContainer.querySelector('legend, h3, h4, h5, span, p');
    if (headerOrLegend && headerOrLegend.textContent?.trim() && headerOrLegend.textContent.length < 150) {
      return headerOrLegend.textContent.trim();
    }
  }

  // 5. Placeholder or name
  return element.getAttribute('placeholder') || element.getAttribute('name') || '';
}

export function classifyField(
  element: HTMLInputElement | HTMLTextAreaElement,
  label: string
): StandardFieldType | 'custom_question' {
  const name = (element.getAttribute('name') || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const text = `${label} ${name} ${id} ${autocomplete}`.toLowerCase();

  if (element.tagName === 'TEXTAREA') {
    return 'custom_question';
  }

  if (/(first[-_\s]?name|^first$|given[-_\s]?name)/i.test(text)) {
    return 'firstName';
  }
  if (/(last[-_\s]?name|^last$|family[-_\s]?name|surname)/i.test(text)) {
    return 'lastName';
  }
  if (/(full[-_\s]?name|^name$|candidate[-_\s]?name)/i.test(text)) {
    return 'fullName';
  }
  if (element.type === 'email' || /email|e-mail/i.test(text)) {
    return 'email';
  }
  if (element.type === 'tel' || /phone|mobile|telephone|cell/i.test(text)) {
    return 'phone';
  }
  if (/linkedin/i.test(text)) {
    return 'linkedin';
  }
  if (/github/i.test(text)) {
    return 'github';
  }
  if (/portfolio|website|personal[-_\s]?url|personal[-_\s]?site/i.test(text)) {
    return 'portfolio';
  }
  if (/city|location|address[-_\s]?city/i.test(text)) {
    return 'city';
  }

  // If input is text and label looks like a screening question
  if (
    label.length > 20 ||
    /\?|why|describe|years of|experience|salary|authorized|sponsorship|notice/i.test(label)
  ) {
    return 'custom_question';
  }

  return 'custom_question';
}

export function scanFormFields(): {
  standardFields: DetectedField[];
  customQuestions: DetectedField[];
} {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'
    )
  );

  const standardFields: DetectedField[] = [];
  const customQuestions: DetectedField[] = [];

  inputs.forEach((elem, index) => {
    // Ignore hidden or zero-dimension inputs
    if (elem.offsetParent === null && elem.type !== 'textarea') return;

    const label = findFieldLabel(elem);
    const classification = classifyField(elem, label);
    const id = elem.id || elem.getAttribute('name') || `qf_field_${index}`;

    const field: DetectedField = {
      id,
      element: elem,
      type: classification,
      label: label || `Field #${index + 1}`,
      placeholder: elem.placeholder || '',
      value: elem.value || '',
      isTextarea: elem.tagName === 'TEXTAREA',
    };

    if (classification === 'custom_question') {
      customQuestions.push(field);
    } else {
      standardFields.push(field);
    }
  });

  return { standardFields, customQuestions };
}

export function extractJobMetadata(): JobMetadata {
  const title =
    document.querySelector('h1')?.textContent?.trim() ||
    document.title.split(/[-|–]/)[0]?.trim() ||
    'Job Application';

  // Company detection heuristics
  let company = '';
  const hostname = window.location.hostname;
  if (hostname.includes('greenhouse.io')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    company = parts[0] || 'Company';
  } else if (hostname.includes('lever.co')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    company = parts[0] || 'Company';
  } else if (hostname.includes('ashbyhq.com')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    company = parts[0] || 'Company';
  } else {
    // Try meta tag or document title
    const metaCompany = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
    company = metaCompany || hostname.replace('www.', '').split('.')[0];
  }

  // Description snippet extraction
  const descContainer =
    document.querySelector('[data-automation-id="job-posting-description"]') ||
    document.querySelector('#content') ||
    document.querySelector('.description') ||
    document.querySelector('article') ||
    document.querySelector('main');

  const rawDesc = descContainer ? descContainer.textContent || '' : document.body.innerText.slice(0, 3000);
  const cleanDesc = rawDesc.replace(/\s+/g, ' ').trim().slice(0, 1500);

  return {
    title,
    company: company.charAt(0).toUpperCase() + company.slice(1),
    descriptionSnippet: cleanDesc,
  };
}
