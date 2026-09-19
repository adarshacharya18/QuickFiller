export function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  shouldBlur: boolean = true
): boolean {
  if (!element || value === undefined || value === null) return false;

  try {
    element.focus();

    const previousValue = element.value;
    const win = element.ownerDocument?.defaultView || window;

    // 1. Direct assignment to element
    element.value = value;

    // 2. Call prototype setter to notify React/Angular/Vue internal state
    try {
      const proto =
        element.tagName === 'TEXTAREA'
          ? win.HTMLTextAreaElement.prototype
          : win.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      }
    } catch {
      // Ignore cross-realm prototype call errors
    }

    // 3. Update React internal value tracker if present
    try {
      const tracker = (element as any)._valueTracker;
      if (tracker) {
        tracker.setValue(previousValue);
      }
    } catch {
      // Ignore tracker errors
    }

    // 4. Fallback direct assignment if value wasn't updated
    if (element.value !== value) {
      element.value = value;
    }

    // 5. Trigger complete cycle of browser events with composed: true
    try {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          cancelable: true,
          data: value,
          inputType: 'insertText',
        })
      );
    } catch {
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
    }

    element.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));

    // Key event dispatch for Google Forms / Wiz change detection
    try {
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, key: 'End' }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: 'End' }));
    } catch {}

    if (shouldBlur) {
      try {
        element.blur();
      } catch {}
      element.dispatchEvent(new Event('blur', { bubbles: true, composed: true, cancelable: true }));
    }

    // 6. Web Component / Shadow DOM host synchronization (e.g. Darwinbox Stencil dbx-ds-text-input)
    try {
      const rootNode = element.getRootNode();
      if (rootNode && 'host' in rootNode) {
        const host = (rootNode as ShadowRoot).host as any;
        if (host) {
          if ('value' in host || host.value !== undefined) {
            host.value = value;
          }
          host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          try {
            host.dispatchEvent(
              new CustomEvent('dbxInput', { bubbles: true, composed: true, detail: { value } })
            );
            host.dispatchEvent(
              new CustomEvent('dbxChange', { bubbles: true, composed: true, detail: { value } })
            );
          } catch {
            // Ignore custom event error
          }
          if (shouldBlur) {
            host.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
          }
        }
      }
    } catch {
      // Ignore host sync error
    }

    return true;
  } catch (err) {
    console.error('[QuickFiller] Error setting input value:', err);
    try {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch {
      // Ignore fallback error
    }
    return false;
  }
}

/**
 * Programmatically checks a radio button (either native HTMLInputElement or ARIA role="radio" element),
 * triggering prototype setters, value trackers, pointer/mouse events, click, and change events
 * required by modern reactive frameworks (React, Angular, Vue, Stencil, Google Forms Material, Workday).
 */
export function setNativeRadioChecked(element: HTMLInputElement | HTMLElement): boolean {
  if (!element) return false;

  try {
    element.focus?.();
    const win = element.ownerDocument?.defaultView || window;
    const isNativeRadio =
      (element instanceof (win.HTMLInputElement || HTMLInputElement) || element.tagName === 'INPUT') &&
      (element as HTMLInputElement).type === 'radio';

    if (isNativeRadio) {
      const radioInput = element as HTMLInputElement;

      // 1. Prototype setter call to notify React/Vue/Angular
      try {
        const proto = win.HTMLInputElement?.prototype || HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'checked');
        if (descriptor && descriptor.set) {
          descriptor.set.call(radioInput, true);
        } else {
          radioInput.checked = true;
        }
      } catch {
        radioInput.checked = true;
      }

      // 2. React _valueTracker update
      try {
        const tracker = (radioInput as any)._valueTracker;
        if (tracker) {
          tracker.setValue(false);
        }
      } catch {}

      // 3. Pointer and mouse events leading to native click
      try {
        radioInput.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true })
        );
        radioInput.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true })
        );
        radioInput.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, cancelable: true })
        );
        radioInput.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, composed: true, cancelable: true })
        );
      } catch {}

      try {
        radioInput.click();
      } catch {}

      radioInput.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
      radioInput.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));

      // Web Component / Shadow DOM host synchronization
      try {
        const rootNode = radioInput.getRootNode();
        if (rootNode && 'host' in rootNode) {
          const host = (rootNode as ShadowRoot).host as any;
          if (host) {
            if ('checked' in host) host.checked = true;
            host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            try {
              host.dispatchEvent(
                new CustomEvent('dbxChange', { bubbles: true, composed: true, detail: { checked: true } })
              );
            } catch {}
          }
        }
      } catch {}

      return true;
    }

    // ARIA role="radio" (e.g. Google Forms .appsMaterialWizToggleRadiogroupEl or custom divs)
    if (element.getAttribute?.('role') === 'radio' || element.closest?.('[role="radio"]')) {
      const target = (
        element.getAttribute?.('role') === 'radio' ? element : element.closest('[role="radio"]')
      ) as HTMLElement;

      try {
        target.setAttribute('aria-checked', 'true');
        target.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true })
        );
        target.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true })
        );
        target.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, cancelable: true })
        );
        target.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, composed: true, cancelable: true })
        );
      } catch {}

      try {
        target.click();
      } catch {}

      target.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
      target.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));
      return true;
    }

    // Fallback click on whatever element passed
    element.click?.();
    return true;
  } catch (err) {
    console.error('[QuickFiller] Error setting radio checked:', err);
    try {
      element.click?.();
    } catch {}
    return false;
  }
}

export interface CursorTargetInfo {
  element: HTMLElement;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

/**
 * Scans the active document for open or visible messaging boxes (LinkedIn, Gmail, Twitter/X, rich-text).
 */
export function findVisibleMessagingTarget(): HTMLElement | null {
  const candidateSelectors = [
    // 1. LinkedIn active messaging window & popups
    'div.msg-form__contenteditable[contenteditable="true"]',
    'div.msg-form__msg-content-container [contenteditable="true"]',
    'div.msg-convo-wrapper [contenteditable="true"]',
    'div[data-artdeco-is-focused="true"][contenteditable="true"]',
    'textarea#custom-message', // LinkedIn connection invitation note
    'textarea[name="message"]',
    'textarea.send-invite__custom-message',
    // 2. Gmail compose body
    'div[aria-label*="Message Body"][contenteditable="true"]',
    'div[role="textbox"][aria-label*="Body"][contenteditable="true"]',
    // 3. Twitter / X Direct Message & tweet box
    'div[data-testid="dmComposerTextInput"][contenteditable="true"]',
    'div[data-testid="tweetTextarea_0"][contenteditable="true"]',
    // 4. Generic rich text editors & contenteditables
    'div[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"]',
    'textarea:not([disabled]):not([readonly])',
  ];

  for (const selector of candidateSelectors) {
    try {
      const matches = document.querySelectorAll<HTMLElement>(selector);
      for (const candidate of Array.from(matches)) {
        if (
          candidate.closest('quickfiller-drawer') ||
          candidate.tagName.toLowerCase() === 'quickfiller-drawer'
        ) {
          continue;
        }
        if (
          candidate.offsetWidth > 0 ||
          candidate.offsetHeight > 0 ||
          candidate.getClientRects().length > 0
        ) {
          return candidate;
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Inserts text at the current caret/cursor position or replaces active selection.
 * Handles inputs, textareas, and contenteditable elements while preserving focus.
 */
export function insertTextAtCursor(
  text: string,
  targetInfo?: CursorTargetInfo | HTMLElement | null
): boolean {
  if (!text) return false;

  let el: HTMLElement | null = null;
  let savedStart: number | null = null;
  let savedEnd: number | null = null;

  if (targetInfo) {
    if ('element' in targetInfo) {
      el = targetInfo.element;
      savedStart = targetInfo.selectionStart ?? null;
      savedEnd = targetInfo.selectionEnd ?? null;
    } else if (targetInfo instanceof HTMLElement) {
      el = targetInfo;
    }
  }

  // If no target provided or element is detached from document, check document.activeElement
  const isElConnected = el && (el.isConnected ?? document.contains(el));
  if (!el || !isElConnected) {
    let active = document.activeElement as HTMLElement | null;
    // Drill into activeElement inside open shadow roots
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement as HTMLElement;
    }

    if (
      active &&
      active.tagName !== 'BODY' &&
      active.tagName.toLowerCase() !== 'quickfiller-drawer' &&
      !active.closest?.('quickfiller-drawer')
    ) {
      el = active;
    }
  }

  // Fallback: If still no target or target is not an input/editable, look for visible messaging boxes (LinkedIn popup, etc.)
  if (
    !el ||
    !(el.isConnected ?? document.contains(el)) ||
    (!el.isContentEditable &&
      el.getAttribute('contenteditable') !== 'true' &&
      el.tagName !== 'INPUT' &&
      el.tagName !== 'TEXTAREA')
  ) {
    const discovered = findVisibleMessagingTarget();
    if (discovered) {
      el = discovered;
    }
  }

  const finalConnected = el && (el.isConnected ?? document.contains(el));
  if (!el || !finalConnected) {
    return false;
  }

  try {
    el.focus();

    // 1. ContentEditable elements (e.g. LinkedIn message popup, Gmail, rich-text editors)
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      // Ensure selection is inside el so document.execCommand targets this contenteditable
      const sel = window.getSelection();
      if (sel) {
        if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      // Dispatch beforeinput for modern editors like Draft.js / Lexical
      try {
        el.dispatchEvent(
          new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertText',
          })
        );
      } catch {}

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, text);
      } catch {
        inserted = false;
      }

      // If execCommand failed or didn't insert, simulate clipboard paste (universal for Draft.js / Lexical)
      if (!inserted || !el.textContent?.includes(text)) {
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });
          el.dispatchEvent(pasteEvent);
        } catch {}
      }

      // If text is still not present, direct DOM insertion with paragraph structure
      if (!el.textContent?.includes(text)) {
        let p = el.querySelector('p:not(.msg-form__placeholder)');
        if (!p) {
          p = el.querySelector('p');
        }
        if (p) {
          p.textContent = text;
        } else {
          el.textContent = text;
        }
      }

      // Dispatch full suite of reactive framework input & change events (enables LinkedIn "Send" button)
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertText',
          })
        );
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ' ' }));

      const parentForm = el.closest('form, .msg-form, .msg-convo-wrapper');
      if (parentForm) {
        parentForm.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        parentForm.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }

      return true;
    }

    // 2. Input / Textarea elements
    const tagName = el.tagName?.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

      // Restore selection if saved positions exist
      if (savedStart !== null && savedEnd !== null) {
        try {
          inputEl.setSelectionRange(savedStart, savedEnd);
        } catch {
          // Unsupported input types like email/number
        }
      }

      const initialVal = inputEl.value || '';
      let execWorked = false;
      try {
        execWorked = document.execCommand('insertText', false, text);
      } catch {
        execWorked = false;
      }

      // If execCommand succeeded and value changed
      if (execWorked && inputEl.value !== initialVal) {
        try {
          inputEl.dispatchEvent(
            new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' })
          );
        } catch {
          inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        inputEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        return true;
      }

      // Fallback: manually splice and apply prototype setter
      let start = initialVal.length;
      let end = initialVal.length;
      try {
        if (inputEl.selectionStart !== null && inputEl.selectionEnd !== null) {
          start = inputEl.selectionStart;
          end = inputEl.selectionEnd;
        }
      } catch {
        start = initialVal.length;
        end = initialVal.length;
      }

      const updatedVal = initialVal.slice(0, start) + text + initialVal.slice(end);
      setNativeInputValue(inputEl, updatedVal, false);

      const nextCursorPos = start + text.length;
      try {
        inputEl.setSelectionRange(nextCursorPos, nextCursorPos);
      } catch {
        // Ignore if selection not supported
      }

      return true;
    }

    return false;
  } catch (err) {
    console.error('[QuickFiller] Error inserting text at cursor:', err);
    return false;
  }
}

