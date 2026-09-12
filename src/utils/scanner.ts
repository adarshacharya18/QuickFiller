export type StandardFieldType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'city'
  | 'state'
  | 'postalCode';

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

export function isElementVisible(elem: HTMLElement): boolean {
  if (!elem) return false;
  if (elem.style.display === 'none' || elem.style.visibility === 'hidden') return false;

  const style = window.getComputedStyle(elem);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // If element has layout dimensions or rects
  if (elem.offsetWidth > 0 || elem.offsetHeight > 0 || elem.getClientRects().length > 0) {
    return true;
  }

  // Fixed/sticky elements have offsetParent === null by CSS spec
  if (style.position === 'fixed' || style.position === 'sticky') {
    return true;
  }

  return elem.offsetParent !== null;
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
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select').forEach((n) => n.remove());
    if (clone.textContent?.trim()) {
      return clone.textContent.trim();
    }
  }

  // 3. ARIA attributes
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
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
    if (
      headerOrLegend &&
      headerOrLegend.textContent?.trim() &&
      headerOrLegend.textContent.length < 150
    ) {
      return headerOrLegend.textContent.trim();
    }
  }

  // 5. Placeholder, title or name fallback
  return (
    element.getAttribute('placeholder') ||
    element.getAttribute('title') ||
    element.getAttribute('name') ||
    ''
  );
}

export function classifyField(
  element: HTMLInputElement | HTMLTextAreaElement,
  label: string
): StandardFieldType | 'custom_question' {
  const name = (element.getAttribute('name') || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const automationId = (element.getAttribute('data-automation-id') || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const text = `${label} ${name} ${id} ${placeholder} ${autocomplete} ${automationId} ${ariaLabel}`.toLowerCase();

  if (element.tagName === 'TEXTAREA') {
    return 'custom_question';
  }

  if (/(first[-_\s]?name|^first$|given[-_\s]?name|fname)/i.test(text)) {
    return 'firstName';
  }
  if (/(last[-_\s]?name|^last$|family[-_\s]?name|surname|lname)/i.test(text)) {
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
  if (/(postal[-_\s]?code|zip[-_\s]?code|^zip$)/i.test(text)) {
    return 'postalCode';
  }
  if (/(state|province|region)/i.test(text)) {
    return 'state';
  }
  if (/(city|location|address[-_\s]?city)/i.test(text)) {
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
    // Check visibility without dropping fixed-position modals
    if (!isElementVisible(elem) && elem.tagName !== 'TEXTAREA') return;

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
