export function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): boolean {
  if (!element || value === undefined || value === null) return false;

  try {
    element.focus();

    // Bypass React / Angular / Vue synthetic property setters
    const prototype = Object.getPrototypeOf(element);
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    // Trigger complete cycle of browser events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    return true;
  } catch (err) {
    console.error('[QuickFiller] Error setting input value:', err);
    try {
      element.value = value;
    } catch {
      // Ignore fallback error
    }
    return false;
  }
}
