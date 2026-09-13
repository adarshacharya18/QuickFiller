import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseTabFromUrl } from '../src/entrypoints/options/App';

describe('Options Page Tab Navigation', () => {
  const originalLocation = window.location;

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('defaults to profile tab when no tab param or hash is specified', () => {
    delete (window as any).location;
    (window as any).location = new URL('chrome-extension://xyz/options.html');
    expect(parseTabFromUrl()).toBe('profile');
  });

  it('activates applications tab when ?tab=applications is in query params', () => {
    delete (window as any).location;
    (window as any).location = new URL('chrome-extension://xyz/options.html?tab=applications');
    expect(parseTabFromUrl()).toBe('applications');
  });

  it('activates applications tab when ?tab=tracker is in query params', () => {
    delete (window as any).location;
    (window as any).location = new URL('chrome-extension://xyz/options.html?tab=tracker');
    expect(parseTabFromUrl()).toBe('applications');
  });

  it('activates applications tab when hash #applications is used', () => {
    delete (window as any).location;
    (window as any).location = new URL('chrome-extension://xyz/options.html#applications');
    expect(parseTabFromUrl()).toBe('applications');
  });

  it('activates questions and settings tabs appropriately', () => {
    delete (window as any).location;
    (window as any).location = new URL('chrome-extension://xyz/options.html?tab=questions');
    expect(parseTabFromUrl()).toBe('questions');

    (window as any).location = new URL('chrome-extension://xyz/options.html?tab=settings');
    expect(parseTabFromUrl()).toBe('settings');
  });
});
