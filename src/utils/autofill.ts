export function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): boolean {
  if (!element || value === undefined || value === null) return false;

  try {
    element.focus();

    const previousValue = element.value;

    // 1. Call prototype setter to bypass React / Vue / Angular wrappers
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    // 2. Update React internal value tracker if present
    const tracker = (element as any)._valueTracker;
    if (tracker) {
      tracker.setValue(previousValue);
    }

    // 3. Fallback direct assignment if value wasn't updated
    if (element.value !== value) {
      element.value = value;
    }

    // 4. Trigger complete cycle of browser events
    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, data: value })
    );
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    return true;
  } catch (err) {
    console.error('[QuickFiller] Error setting input value:', err);
    try {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // Ignore fallback error
    }
    return false;
  }
}
