import {
  RadioOption,
  DetectedRadioGroup,
  RadioGroupCategory,
  classifyRadioGroup,
} from './radioResolver';

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
  type: StandardFieldType | 'custom_question' | 'cover_letter';
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

  if (elem.closest('[hidden], [style*="display: none"], [style*="display:none"]')) {
    return false;
  }

  try {
    const style = window.getComputedStyle(elem);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    if (style.position === 'fixed' || style.position === 'sticky') {
      return elem.getClientRects().length > 0;
    }
  } catch {
    return false;
  }

  // Inside Shadow DOM or detached subtrees, offsetParent may be null even when rendered.
  // Check layout dimensions and client rects first.
  if (elem.offsetWidth > 0 || elem.offsetHeight > 0 || elem.getClientRects().length > 0) {
    return true;
  }

  if (elem.offsetParent === null) {
    return false;
  }

  return true;
}

function extractCleanText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      'input, textarea, select, abbr, .requiredAsterisk, [class*="required"], [data-automation-id*="required"], [data-automation-id*="Asterisk"], .vHW8du, [aria-label*="Required"], [aria-label*="required"]'
    )
    .forEach((n) => n.remove());
  return (clone.textContent || '').replace(/\s*[\*:]\s*$/, '').trim();
}

export function findFieldLabel(element: HTMLElement): string {
  const rootNode = element.getRootNode() as Document | ShadowRoot;

  // 1. Explicit <label for="..."> (searches current root and main document)
  if (element.id) {
    try {
      if (rootNode && 'querySelector' in rootNode) {
        const localLabel = rootNode.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (localLabel) {
          const txt = extractCleanText(localLabel as HTMLElement);
          if (txt) return txt;
        }
      }
      const docLabel = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (docLabel) {
        const txt = extractCleanText(docLabel as HTMLElement);
        if (txt) return txt;
      }
    } catch {
      // Ignore CSS escape or querySelector errors
    }
  }

  // 2. Wrapping <label>
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const txt = extractCleanText(parentLabel);
    if (txt) return txt;
  }

  // 3. ARIA attributes
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.replace(/\s*[\*:]\s*$/, '').trim();
  }

  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
    const texts = ids
      .map((id) => {
        try {
          let el: HTMLElement | null = null;
          if (rootNode && 'getElementById' in rootNode) {
            el = (rootNode as Document).getElementById(id);
          }
          if (!el) {
            el = document.getElementById(id);
          }
          if (el) return extractCleanText(el);
          return null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (texts.length > 0) {
      return texts.join(' ');
    }
  }

  // 4. Preceding sibling label or container (including Workday [data-automation-id="formLabel"])
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL' || prev.querySelector('label, [data-automation-id="formLabel"]')) {
      const lbl = (prev.tagName === 'LABEL' ? prev : prev.querySelector('label, [data-automation-id="formLabel"]')) as HTMLElement;
      if (lbl) {
        const txt = extractCleanText(lbl);
        if (txt) return txt;
      }
    }
    prev = prev.previousElementSibling;
  }

  // 5. Ancestor container label lookup (e.g. Workday [data-automation-id^="formField-"], form group, fieldset)
  const container = element.closest(
    '.form-group, .field, [class*="form-item"], [class*="field-"], [data-automation-id^="formField-"], [data-automation-id*="formField"], [data-automation-id="formField"], tr, td, li'
  );
  if (container) {
    const lbl = container.querySelector(
      'label, [data-automation-id="formLabel"], [class*="label"], span.title, div.title'
    ) as HTMLElement;
    if (lbl) {
      const txt = extractCleanText(lbl);
      if (txt) return txt;
    }
  }

  // 5b. Google Forms item container & heading lookup (div[role="listitem"], .Qr7Oae, .geS5n)
  const gformContainer = element.closest(
    'div[role="listitem"], .Qr7Oae, .geS5n, .freebirdFormviewerViewItemsItemItem'
  );
  if (gformContainer) {
    const gformHeading = gformContainer.querySelector(
      'div[role="heading"], [jsname="r4nke"], .M7eMe, .freebirdFormviewerViewItemsItemItemTitle, .HoDLxf'
    ) as HTMLElement;
    if (gformHeading) {
      const txt = extractCleanText(gformHeading);
      if (txt) return txt;
    }
  }

  // 6. Web Component / Shadow DOM Host inspection (e.g. Darwinbox dbx-ds-text-input, dbx-ds-form-field)
  try {
    if (rootNode && 'host' in rootNode) {
      const host = (rootNode as ShadowRoot).host as HTMLElement;
      if (host) {
        // Direct label / placeholder on custom element: <dbx-ds-text-input label="First Name">
        const hostLabel =
          host.getAttribute('label') ||
          host.getAttribute('data-label') ||
          host.getAttribute('aria-label');
        if (hostLabel && hostLabel.trim()) {
          return hostLabel.trim();
        }

        // Host parent container (e.g. <dbx-ds-form-field label="First Name">)
        const hostParent = host.closest(
          'dbx-ds-form-field, .form-group, .field, [class*="form-item"], [class*="field-"]'
        );
        if (hostParent) {
          const parentLabel =
            hostParent.getAttribute('label') ||
            hostParent.querySelector('label, [class*="label"], span.title, div.title')?.textContent?.trim();
          if (parentLabel && parentLabel.trim()) {
            return parentLabel.trim();
          }
        }

        // Check surrounding light DOM around host
        const hostSibling = host.previousElementSibling;
        if (hostSibling && (hostSibling.tagName === 'LABEL' || hostSibling.querySelector('label'))) {
          const lblText = hostSibling.textContent?.trim();
          if (lblText) return lblText;
        }

        // Check if host has an internal label inside shadow root
        const shadowLabel = (rootNode as ShadowRoot).querySelector('label, .dbx-label, [class*="label"]');
        if (shadowLabel && shadowLabel.textContent?.trim()) {
          return shadowLabel.textContent.trim();
        }
      }
    }
  } catch {
    // Ignore shadow root access issues
  }

  // 7. Name / placeholder fallback
  return element.getAttribute('name') || element.getAttribute('placeholder') || '';
}

export function classifyField(
  element: HTMLInputElement | HTMLTextAreaElement,
  label: string
): StandardFieldType | 'custom_question' | 'cover_letter' {
  const name = (
    element.getAttribute('name') ||
    element.getAttribute('formcontrolname') ||
    element.getAttribute('ng-reflect-name') ||
    ''
  ).toLowerCase();
  const id = (element.id || '').toLowerCase();
  const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const automationId = (
    element.getAttribute('data-automation-id') ||
    element.getAttribute('data-qa') ||
    ''
  ).toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

  // Also inspect container automation id (Workday formField container convention: div[data-automation-id="formField-legalNameSection_firstName"])
  const containerAutomationId = (
    element.closest('[data-automation-id*="formField-"], [data-automation-id*="formField"]')?.getAttribute('data-automation-id') || ''
  ).toLowerCase();

  // Also inspect host custom element if inside Shadow DOM (e.g. Darwinbox dbx-ds-text-input)
  let hostName = '';
  let hostLabel = '';
  let hostAutomationId = '';
  let hostPlaceholder = '';
  try {
    const rootNode = element.getRootNode();
    if (rootNode && 'host' in rootNode) {
      const host = (rootNode as ShadowRoot).host as HTMLElement;
      if (host) {
        hostName = (
          host.getAttribute('name') ||
          host.getAttribute('formcontrolname') ||
          host.getAttribute('ng-reflect-name') ||
          ''
        ).toLowerCase();
        hostLabel = (
          host.getAttribute('label') ||
          host.getAttribute('data-label') ||
          host.getAttribute('aria-label') ||
          ''
        ).toLowerCase();
        hostAutomationId = (
          host.getAttribute('data-automation-id') ||
          host.getAttribute('data-qa') ||
          ''
        ).toLowerCase();
        hostPlaceholder = (host.getAttribute('placeholder') || '').toLowerCase();
      }
    }
  } catch {
    // Ignore
  }

  // Workday high-confidence direct data-automation-id checks
  const combinedAutoId = `${automationId} ${containerAutomationId} ${hostAutomationId}`;
  if (
    /legalnamesection_firstname|preferrednamesection_firstname|\bfirstname\b/.test(combinedAutoId)
  ) {
    return 'firstName';
  }
  if (
    /legalnamesection_lastname|preferrednamesection_lastname|\blastname\b/.test(combinedAutoId)
  ) {
    return 'lastName';
  }
  if (/\bemail\b|contactinformation_email/.test(combinedAutoId)) {
    return 'email';
  }
  if (/phone[-_]?number|phonenumber|contactinformation_phone/.test(combinedAutoId)) {
    return 'phone';
  }
  if (/addresssection_postalcode|\bpostalcode\b|\bzipcode\b/.test(combinedAutoId)) {
    return 'postalCode';
  }
  if (/addresssection_countryregion|countryregion|\bregion\b|\bstate\b/.test(combinedAutoId)) {
    return 'state';
  }
  if (/addresssection_city|\bcity\b/.test(combinedAutoId)) {
    return 'city';
  }
  if (/linkedinquestion|linkedinurl|\blinkedin\b/.test(combinedAutoId)) {
    return 'linkedin';
  }
  if (/githubquestion|\bgithub\b/.test(combinedAutoId)) {
    return 'github';
  }
  if (/websitequestion|portfolioquestion|\bwebsite\b|\bportfolio\b/.test(combinedAutoId)) {
    return 'portfolio';
  }
  if (/coverletter|cover[-_]?letter|statementofpurpose/.test(combinedAutoId)) {
    return 'cover_letter';
  }

  const text = `${label} ${hostLabel} ${name} ${hostName} ${id} ${placeholder} ${hostPlaceholder} ${autocomplete} ${automationId} ${containerAutomationId} ${hostAutomationId} ${ariaLabel}`.toLowerCase();

  // Explicit cover letter detection
  if (/cover[-_\s]?letter|statement\s*of\s*(purpose|interest)|motivation[-_\s]?letter|letter\s*of\s*motivation/i.test(text)) {
    return 'cover_letter';
  }

  if (element.tagName === 'TEXTAREA') {
    return 'custom_question';
  }

  if (/(first[-_\s]?name|^first$|given[-_\s]?name|fname|legalnamesection_firstname|preferrednamesection_firstname)/i.test(text)) {
    return 'firstName';
  }
  if (/(last[-_\s]?name|^last$|family[-_\s]?name|surname|lname|legalnamesection_lastname|preferrednamesection_lastname)/i.test(text)) {
    return 'lastName';
  }
  if (/(full[-_\s]?name|^name$|candidate[-_\s]?name|legalname\b)/i.test(text)) {
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
  // If input is text and label looks like a screening question
  if (
    label.length > 25 ||
    /\?|why|describe|years of|experience|salary|authorized|sponsorship|notice/i.test(label)
  ) {
    return 'custom_question';
  }

  if (/(postal[-_\s]?code|zip[-_\s]?code|^zip$|addresssection_postalcode)/i.test(text)) {
    return 'postalCode';
  }
  if (/(\bstate\b|\bprovince\b|\bregion\b|countryregion|addresssection_countryregion)/i.test(text)) {
    return 'state';
  }
  if (/(city|location|address[-_\s]?city|addresssection_city)/i.test(text)) {
    return 'city';
  }

  return 'custom_question';
}

/**
 * Checks if a node or element is inside the QuickFiller drawer UI (custom element or shadow root).
 * Prevents QuickFiller's internal UI elements (textareas, inputs, search boxes) from being
 * detected as form fields on the web page.
 */
export function isInsideQuickFillerDrawer(node: Node | null): boolean {
  if (!node) return false;
  let curr: Node | null = node;
  while (curr) {
    if (curr instanceof Element) {
      const tag = curr.tagName ? curr.tagName.toLowerCase() : '';
      if (
        tag === 'quickfiller-drawer' ||
        curr.getAttribute('data-quickfiller-ui') === 'true' ||
        curr.hasAttribute('wxt-shadow-root-document-styles')
      ) {
        return true;
      }
    }
    if (curr instanceof ShadowRoot) {
      const hostTag = curr.host?.tagName ? curr.host.tagName.toLowerCase() : '';
      if (
        hostTag === 'quickfiller-drawer' ||
        curr.host?.getAttribute('data-quickfiller-ui') === 'true'
      ) {
        return true;
      }
      curr = curr.host;
      continue;
    }
    curr = curr.parentNode;
  }
  return false;
}

/**
 * Recursively queries elements across light DOM, open Shadow Roots, and same-origin iframes.
 * Strictly ignores the QuickFiller Copilot Drawer UI and deduplicates discovered elements.
 */
export function querySelectorAllDeep<T extends Element = Element>(
  selector: string,
  root: Document | Element | ShadowRoot = document
): T[] {
  const results: T[] = [];
  const visitedRoots = new Set<Node>();
  const seenElements = new Set<Element>();

  function traverse(node: Document | Element | ShadowRoot) {
    if (!node || visitedRoots.has(node)) return;
    visitedRoots.add(node);

    // Skip traversing if this node is inside or is the QuickFiller drawer UI
    if (isInsideQuickFillerDrawer(node)) {
      return;
    }

    try {
      const matches = node.querySelectorAll<T>(selector);
      for (let i = 0; i < matches.length; i++) {
        const el = matches[i];
        if (!seenElements.has(el) && !isInsideQuickFillerDrawer(el)) {
          seenElements.add(el);
          results.push(el);
        }
      }
    } catch {
      // Ignore selector errors
    }

    try {
      const allElements = node.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];

        // Do not traverse into QuickFiller drawer or its ShadowRoot
        if (
          (el.tagName && el.tagName.toLowerCase() === 'quickfiller-drawer') ||
          isInsideQuickFillerDrawer(el)
        ) {
          continue;
        }

        // 1. Traverse open Shadow Roots (e.g. Darwinbox dbx-ds-text-input, Stencil, Lit)
        if (el.shadowRoot) {
          traverse(el.shadowRoot);
        }

        // 2. Traverse accessible same-origin iframes
        if (el.tagName === 'IFRAME') {
          try {
            const iframeDoc = (el as HTMLIFrameElement).contentDocument;
            if (iframeDoc) {
              traverse(iframeDoc);
            }
          } catch {
            // Cross-origin iframe security block - ignore
          }
        }
      }
    } catch {
      // Ignore traversal errors
    }
  }

  traverse(root);
  return results;
}

export function scanFormFields(): {
  standardFields: DetectedField[];
  customQuestions: DetectedField[];
  radioGroups: DetectedRadioGroup[];
} {
  const inputs = querySelectorAllDeep<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea',
    document
  );

  const standardFields: DetectedField[] = [];
  const customQuestions: DetectedField[] = [];
  const radioGroups: DetectedRadioGroup[] = [];
  const seenElements = new Set<Element>();
  const seenQuestionKeys = new Set<string>();
  const seenStandardKeys = new Set<string>();

  inputs.forEach((elem, index) => {
    // 1. Never scan inside QuickFiller's own UI
    if (isInsideQuickFillerDrawer(elem)) return;

    // 2. Check visibility without dropping fixed-position modals or shadow elements
    if (!isElementVisible(elem)) return;

    // 3. Skip if this exact DOM element was already processed
    if (seenElements.has(elem)) return;
    seenElements.add(elem);

    const label = findFieldLabel(elem);
    const classification = classifyField(elem, label);
    const id = elem.id || elem.getAttribute('name') || `qf_field_${index}`;

    let hostPlaceholder = '';
    try {
      const rootNode = elem.getRootNode();
      if (rootNode && 'host' in rootNode) {
        hostPlaceholder = ((rootNode as ShadowRoot).host as HTMLElement)?.getAttribute('placeholder') || '';
      }
    } catch {}

    const placeholder = elem.placeholder || elem.getAttribute('placeholder') || hostPlaceholder || '';

    const field: DetectedField = {
      id,
      element: elem,
      type: classification,
      label: label || `Field #${index + 1}`,
      placeholder,
      value: elem.value || '',
      isTextarea: elem.tagName === 'TEXTAREA',
    };

    if (classification === 'custom_question' || classification === 'cover_letter') {
      const normLabel = (field.label || '').trim().toLowerCase();
      const cleanLabel = normLabel
        .replace(/\s*[\*:]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const normName = (elem.getAttribute('name') || '').trim().toLowerCase();
      const elemId = (elem.id || '').trim().toLowerCase();

      // Determine unique signature for deduplicating identical questions on the page
      // Prioritize meaningful question label/prompt so responsive clone inputs with different IDs share the same question entry
      const hasMeaningfulLabel =
        cleanLabel &&
        !cleanLabel.startsWith('field #') &&
        cleanLabel.length > 8;

      const dedupKey = hasMeaningfulLabel
        ? `label:${cleanLabel}`
        : elemId
        ? `id:${elemId}`
        : normName
        ? `name:${normName}`
        : `idx:${index}`;

      if (seenQuestionKeys.has(dedupKey)) {
        return;
      }
      seenQuestionKeys.add(dedupKey);

      customQuestions.push(field);
    } else {
      const elemId = (elem.id || elem.getAttribute('name') || '').trim().toLowerCase();
      const stdKey = elemId ? `${classification}:${elemId}` : null;
      if (stdKey) {
        if (seenStandardKeys.has(stdKey)) {
          return;
        }
        seenStandardKeys.add(stdKey);
      }
      standardFields.push(field);
    }
  });

  // Radio button scanning: native radio inputs + ARIA role="radio" buttons (e.g. Google Forms, Workday)
  const nativeRadios = querySelectorAllDeep<HTMLInputElement>(
    'input[type="radio"]:not([type="hidden"])',
    document
  );
  const ariaRadios = querySelectorAllDeep<HTMLElement>(
    '[role="radio"]:not(input)',
    document
  );

  const allRadioElements = [...nativeRadios, ...ariaRadios];
  const rawGroups = new Map<
    string,
    {
      container: HTMLElement | null;
      elements: (HTMLInputElement | HTMLElement)[];
      name: string;
    }
  >();

  allRadioElements.forEach((elem) => {
    if (isInsideQuickFillerDrawer(elem)) return;
    const isVis =
      isElementVisible(elem) ||
      (elem.parentElement && isElementVisible(elem.parentElement));
    if (!isVis) return;

    // Discover grouping container
    const radiogroup = elem.closest('[role="radiogroup"]');
    const container =
      (radiogroup
        ? (radiogroup.closest(
            'div[role="listitem"], .Qr7Oae, .geS5n, fieldset, .form-group, .field'
          ) as HTMLElement | null) || (radiogroup as HTMLElement)
        : null) ||
      (elem.closest(
        '[role="radiogroup"], fieldset, [data-automation-id*="formField"], div[role="listitem"], .Qr7Oae, .geS5n, .form-group, .field, [class*="radio-group"]'
      ) as HTMLElement | null);

    const radioName =
      (elem instanceof HTMLInputElement ? elem.name : '') ||
      elem.getAttribute('name') ||
      '';

    let groupKey = '';
    if (container) {
      if (!container.dataset.qfRadioGroupId) {
        container.dataset.qfRadioGroupId = `qf_radiogrp_${Math.random().toString(36).slice(2, 9)}`;
      }
      groupKey = container.dataset.qfRadioGroupId;
    } else if (radioName) {
      groupKey = `name:${radioName}`;
    } else {
      const parent = elem.parentElement;
      if (parent) {
        if (!parent.dataset.qfRadioGroupId) {
          parent.dataset.qfRadioGroupId = `qf_p_${Math.random().toString(36).slice(2, 9)}`;
        }
        groupKey = parent.dataset.qfRadioGroupId;
      } else {
        groupKey = `orphan_${Math.random().toString(36).slice(2, 9)}`;
      }
    }

    if (!rawGroups.has(groupKey)) {
      rawGroups.set(groupKey, {
        container,
        elements: [],
        name: radioName,
      });
    }
    rawGroups.get(groupKey)!.elements.push(elem);
  });

  const seenRadioLabels = new Set<string>();

  Array.from(rawGroups.values()).forEach((rawGroup, groupIdx) => {
    const { container, elements, name } = rawGroup;
    if (elements.length === 0) return;

    // 1. Resolve Overarching Question Prompt
    let groupPrompt = '';
    if (container) {
      // a. <legend> inside fieldset
      const legend = container.querySelector('legend');
      if (legend) {
        groupPrompt = extractCleanText(legend);
      }

      // b. aria-labelledby
      if (!groupPrompt) {
        const labelledBy = container.getAttribute('aria-labelledby');
        if (labelledBy) {
          const ids = labelledBy.split(/\s+/).filter(Boolean);
          const parts = ids
            .map((id) => {
              const el = document.getElementById(id);
              return el ? extractCleanText(el) : null;
            })
            .filter(Boolean);
          if (parts.length > 0) groupPrompt = parts.join(' ');
        }
      }

      // c. Google Forms heading: div[role="heading"], .M7eMe, [jsname="r4nke"]
      if (!groupPrompt) {
        const gHeading = container.querySelector(
          'div[role="heading"], [jsname="r4nke"], .M7eMe, .freebirdFormviewerViewItemsItemItemTitle, .HoDLxf'
        ) as HTMLElement;
        if (gHeading) groupPrompt = extractCleanText(gHeading);
      }

      // d. Workday form label: [data-automation-id="formLabel"]
      if (!groupPrompt) {
        const wdLabel = container.querySelector('[data-automation-id="formLabel"]') as HTMLElement;
        if (wdLabel) groupPrompt = extractCleanText(wdLabel);
      }

      // e. General label / title elements inside container
      if (!groupPrompt) {
        const genLabel = container.querySelector(
          'label, [class*="label"], h3, h4, h5, span.title'
        ) as HTMLElement;
        if (genLabel) groupPrompt = extractCleanText(genLabel);
      }

      // f. aria-label on container or inner radiogroup
      if (!groupPrompt) {
        const ariaLbl =
          container.getAttribute('aria-label') ||
          container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label');
        if (ariaLbl) groupPrompt = ariaLbl.replace(/\s*[\*:]\s*$/, '').trim();
      }
    }

    // Fallback: search previous sibling of first element or container
    if (!groupPrompt) {
      const targetForPrev = container || elements[0];
      let prev = targetForPrev.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'LABEL' || prev.querySelector('label, [role="heading"]')) {
          const l = (
            prev.tagName === 'LABEL' ? prev : prev.querySelector('label, [role="heading"]')
          ) as HTMLElement;
          if (l) {
            groupPrompt = extractCleanText(l);
            break;
          }
        }
        prev = prev.previousElementSibling;
      }
    }

    if (!groupPrompt) {
      groupPrompt = findFieldLabel(elements[0]);
    }

    const cleanPrompt = groupPrompt.replace(/\s*[\*:]\s*$/, '').trim();
    const promptNorm = cleanPrompt.toLowerCase();

    // Deduplicate identical question prompts across responsive clones
    if (promptNorm && promptNorm.length > 8) {
      if (seenRadioLabels.has(promptNorm)) return;
      seenRadioLabels.add(promptNorm);
    }

    // 2. Resolve Options
    const options: RadioOption[] = [];
    elements.forEach((el, optIdx) => {
      let optLabel = '';

      // a. Explicit label[for="..."]
      if (el.id) {
        const root = el.getRootNode() as Document | ShadowRoot;
        try {
          const l =
            (root && 'querySelector' in root
              ? root.querySelector(`label[for="${CSS.escape(el.id)}"]`)
              : null) || document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l) optLabel = extractCleanText(l as HTMLElement);
        } catch {}
      }

      // b. Wrapping label
      if (!optLabel) {
        const parentLabel = el.closest('label');
        if (parentLabel) optLabel = extractCleanText(parentLabel);
      }

      // c. Google Forms option wrapper: .docssharedWizToggleLabeledContainer, .aDTYNe, .snByac
      if (!optLabel) {
        const gformOptWrap = el.closest('.docssharedWizToggleLabeledContainer');
        if (gformOptWrap) {
          const span = gformOptWrap.querySelector('.aDTYNe, .snByac, label');
          if (span) optLabel = extractCleanText(span as HTMLElement);
        }
      }

      // d. ARIA / data attributes
      if (!optLabel) {
        optLabel =
          el.getAttribute('aria-label') ||
          el.getAttribute('data-value') ||
          '';
      }

      // e. Sibling text
      if (!optLabel && el.nextElementSibling) {
        optLabel = extractCleanText(el.nextElementSibling as HTMLElement);
      }

      // f. Fallback: input value
      const optVal =
        (el as HTMLInputElement).value ||
        el.getAttribute('data-value') ||
        el.getAttribute('value') ||
        optLabel ||
        `option_${optIdx + 1}`;

      if (!optLabel) optLabel = optVal;

      const isChecked = Boolean(
        (el as HTMLInputElement).checked ||
        el.getAttribute('aria-checked') === 'true'
      );

      options.push({
        id: el.id || `${name || 'radio'}_opt_${optIdx}`,
        value: optVal,
        label: optLabel,
        element: el,
        isChecked,
      });
    });

    if (options.length === 0) return;

    const containerAttrs = container
      ? container.getAttribute('data-automation-id') || container.className || ''
      : '';
    const category = classifyRadioGroup(cleanPrompt, name, containerAttrs);

    radioGroups.push({
      id: `radiogroup_${groupIdx}`,
      name,
      label: cleanPrompt || `Radio Question #${groupIdx + 1}`,
      category,
      options,
      containerElement: container || undefined,
    });
  });

  return { standardFields, customQuestions, radioGroups };
}

export function extractJobMetadata(): JobMetadata {
  let title =
    document.querySelector(
      '[data-automation-id="jobPostingHeader"], h1, .job-title, [class*="job-title"], [class*="position-title"], [class*="jobTitle"]'
    )?.textContent?.trim() ||
    document.title.split(/[-|–|—|\|]/)[0]?.trim() ||
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
  } else if (hostname.includes('darwinbox.in') || hostname.includes('darwinbox.com')) {
    // Darwinbox: Subdomain is <company>hrms (e.g. leadsquaredhrms.darwinbox.in -> LeadSquared)
    const domCompany = document
      .querySelector(
        '.company, [class*="company-name"], [data-automation-id*="company"], [data-qa*="company"], .org-name, .header-company-name'
      )
      ?.textContent?.split(/[•|\-|—|\|]/)[0]
      ?.trim();

    const metaCompany = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');

    if (domCompany) {
      company = domCompany;
    } else if (metaCompany) {
      company = metaCompany;
    } else {
      const sub = hostname.split('.')[0] || '';
      const cleanSub = sub.replace(/hrms$/i, '').replace(/[-_]/g, ' ');
      company = cleanSub ? cleanSub.charAt(0).toUpperCase() + cleanSub.slice(1) : 'Company';
    }
  } else if (hostname.includes('myworkdayjobs.com') || hostname.includes('workday.com')) {
    // Workday: <company>.myworkdayjobs.com or multi-tenant /en-US/<company>/job/...
    const domCompany = document
      .querySelector(
        '[data-automation-id="companyName"], [data-automation-id="legalEntity"], [data-automation-id="bannerLogo"] img[alt], .company, [class*="company-name"], [data-automation-id*="company"], [data-qa*="company"], .org-name, .header-company-name'
      )
      ?.textContent?.split(/[•|\-|—|\|]/)[0]
      ?.trim();

    const logoAlt = document
      .querySelector('[data-automation-id="bannerLogo"] img[alt], [data-automation-id="site-banner"] img[alt]')
      ?.getAttribute('alt');
    const metaCompany = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');

    if (domCompany) {
      company = domCompany;
    } else if (logoAlt) {
      company = logoAlt.replace(/logo|careers|jobs/gi, '').trim();
    } else if (metaCompany) {
      company = metaCompany;
    } else {
      // 1. Subdomain check: e.g. nvidia.myworkdayjobs.com
      const parts = hostname.split('.');
      let sub = parts[0] || '';
      if (sub.toLowerCase() === 'www' && parts.length > 1) {
        sub = parts[1];
      }
      if (sub && sub !== 'myworkdayjobs' && !/^wd\d+$/i.test(sub)) {
        const cleanSub = sub.replace(/[-_]/g, ' ');
        company = cleanSub.charAt(0).toUpperCase() + cleanSub.slice(1);
      } else {
        // 2. Multi-tenant path: /en-US/disney/job/... -> disney
        const segments = window.location.pathname.split('/').filter(Boolean);
        const tenantIndex = /^[a-z]{2}(-[A-Z]{2})?$/i.test(segments[0] || '') ? 1 : 0;
        if (segments[tenantIndex]) {
          const cleanSeg = segments[tenantIndex].replace(/[-_]/g, ' ');
          company = cleanSeg.charAt(0).toUpperCase() + cleanSeg.slice(1);
        } else {
          company = 'Workday Job';
        }
      }
    }
  } else if (
    hostname.includes('docs.google.com') &&
    (window.location.pathname.includes('/forms/') || window.location.pathname.includes('/forms'))
  ) {
    // Google Forms
    const gformHeading = document.querySelector(
      'div[role="heading"][aria-level="1"], .F9NWFb, .freebirdFormviewerViewHeaderTitle'
    )?.textContent?.trim();

    if (gformHeading) {
      title = gformHeading;
    } else {
      title = document.title.replace(/\s*[-–—|]\s*Google\s*Forms$/i, '').trim() || 'Job Application';
    }

    const titleWithoutGForms = document.title.replace(/\s*[-–—|]\s*Google\s*Forms$/i, '').trim();
    const titleCandidates = [gformHeading, titleWithoutGForms].filter(Boolean) as string[];
    let foundCompany = '';

    for (const text of titleCandidates) {
      const atMatch =
        text.match(/(?:at|with|@)\s+([A-Za-z0-9\s&.,]+)$/i) ||
        text.match(
          /(?:at|with|@)\s+([A-Za-z0-9\s&.,]+?)(?:\s*[-–—|:]|\s+application|\s+form|$)/i
        );
      if (atMatch && atMatch[1]) {
        foundCompany = atMatch[1].trim();
        break;
      }
      const prefixMatch = text.match(
        /^([A-Za-z0-9\s&.,]{2,30}?)\s*[-–—|:]\s*(?:job|internship|application|hiring|engineering|developer|role)/i
      );
      if (prefixMatch && prefixMatch[1]) {
        foundCompany = prefixMatch[1].trim();
        break;
      }
      const hiringMatch = text.match(
        /(?:hiring|careers|team)\s*(?:at|for)?\s*([A-Za-z0-9\s&.,]{2,30})/i
      );
      if (hiringMatch && hiringMatch[1]) {
        foundCompany = hiringMatch[1].trim();
        break;
      }
    }

    if (foundCompany) {
      company = foundCompany;
    } else {
      const desc =
        document.querySelector('.cBGGfd, .freebirdFormviewerViewHeaderDescription')?.textContent || '';
      const descMatch = desc.match(
        /(?:welcome to|joining|about)\s+([A-Za-z0-9\s&.,]{2,30}?)(?:'s|\s+team|\s+is|\.|\,)/i
      );
      if (descMatch && descMatch[1]) {
        company = descMatch[1].trim();
      } else {
        company = 'Company';
      }
    }
  } else {
    // 1. Try explicit DOM element (.company, [class*="company"], [data-automation-id*="company"])
    const domCompany = document
      .querySelector(
        '.company, [class*="company-name"], [data-automation-id*="company"], [data-qa*="company"]'
      )
      ?.textContent?.split(/[•|\-|—]/)[0]
      ?.trim();

    // 2. Try document title (e.g. "Job Title Application - Acme Corp" -> "Acme Corp")
    let titleCompany = '';
    const titleParts = document.title.split(/[-|–|—|\|]/);
    if (titleParts.length > 1) {
      titleCompany = titleParts[titleParts.length - 1].trim();
    }

    // 3. Try meta tag or hostname
    const metaCompany = document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute('content');

    const hostNamePart = hostname ? hostname.replace('www.', '').split('.')[0] : '';

    company =
      domCompany ||
      metaCompany ||
      titleCompany ||
      hostNamePart ||
      'Company';
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

/**
 * Cleans and validates placeholder strings for format hints.
 * Filters out generic instructions ("type here...", "describe...") or pure ellipsis ("..."),
 * and strips trailing ellipsis dots ("e.g. $140k..." -> "e.g. $140k") so UI doesn't look artificially truncated.
 */
export function getCleanFormatHint(placeholder?: string): string | null {
  if (!placeholder) return null;
  const trimmed = placeholder.trim();
  if (!trimmed) return null;

  // If purely dots, spaces, dashes, or punctuation (e.g. "...", "…", "---", "-")
  if (/^[\s.…\-_/]+$/.test(trimmed)) return null;

  // Generic non-informative prompts that aren't format hints
  const isGeneric =
    /^(type|enter|write|input|provide|add|your|fill)(\s+(in|your|the|a|an))?(\s+(here|answer|response|text|message|details|comment|description|info))?(\.{2,}|…)?$/i.test(
      trimmed
    ) ||
    /^(optional|n\/a|none|required)(\.{2,}|…)?$/i.test(trimmed) ||
    /^(describe|explain|tell us|share)\b/i.test(trimmed);

  if (isGeneric) {
    return null;
  }

  // Clean trailing ellipsis/dots if they exist at the end
  // e.g. "e.g. $140,000, 2 weeks notice..." -> "e.g. $140,000, 2 weeks notice"
  const cleaned = trimmed.replace(/\s*(\.{2,}|…)\s*$/, '').trim();

  // If cleaning resulted in empty or purely dots
  if (!cleaned || /^[\s.…\-_/]+$/.test(cleaned)) return null;

  return cleaned;
}

