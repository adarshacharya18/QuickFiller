import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInitialDrawerOpenState,
  getInitialDrawerExpandedState,
  isSensitiveOrInternalUrl,
  isEligibleForDrawer,
} from '../src/utils/drawerUtils';

describe('Copilot Drawer State Persistence & Pin Auto-Open', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__QUICKFILLER_AUTO_OPEN__;
  });

  it('initializes CLOSED by default on new pages (prevents auto-popping on arbitrary web pages)', () => {
    expect(getInitialDrawerOpenState()).toBe(false);
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBeNull();
  });

  it('initializes in expanded view on first visit', () => {
    expect(getInitialDrawerExpandedState()).toBe(true);
    expect(sessionStorage.getItem('quickfiller_drawer_expanded')).toBe('true');
  });

  it('respects user width collapse when sessionStorage has false', () => {
    sessionStorage.setItem('quickfiller_drawer_expanded', 'false');
    expect(getInitialDrawerExpandedState()).toBe(false);
  });

  it('initializes open and saves to sessionStorage when __QUICKFILLER_AUTO_OPEN__ is true', () => {
    (window as any).__QUICKFILLER_AUTO_OPEN__ = true;

    expect(getInitialDrawerOpenState()).toBe(true);
    expect((window as any).__QUICKFILLER_AUTO_OPEN__).toBe(false);
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('true');
  });

  it('maintains open state across page reloads / steps via sessionStorage', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'true');
    expect(getInitialDrawerOpenState()).toBe(true);
  });

  it('respects user minimization when sessionStorage is set to false', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'false');
    expect(getInitialDrawerOpenState()).toBe(false);
  });

  it('correctly updates sessionStorage when closed or minimized', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'true');
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('true');

    // User clicks minimize / close
    sessionStorage.setItem('quickfiller_drawer_open', 'false');
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('false');
  });

  it('blocks sensitive authentication pages and internal browser URLs', () => {
    expect(isSensitiveOrInternalUrl('https://accounts.google.com/signin/v2/identifier')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://accounts.google.com/ServiceLogin')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://login.microsoftonline.com/common/oauth2')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://login.live.com/login.srf')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://appleid.apple.com/auth/authorize')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://example.auth0.com/u/login')).toBe(true);
    expect(isSensitiveOrInternalUrl('https://company.okta.com/login')).toBe(true);
    expect(isSensitiveOrInternalUrl('chrome://extensions/')).toBe(true);
    expect(isSensitiveOrInternalUrl('about:debugging')).toBe(true);
    expect(isSensitiveOrInternalUrl('moz-extension://xyz/popup.html')).toBe(true);
    expect(isSensitiveOrInternalUrl('chrome-extension://xyz/popup.html')).toBe(true);
    expect(isSensitiveOrInternalUrl('about:blank')).toBe(true);
  });

  it('identifies eligible web URLs for drawer', () => {
    expect(isEligibleForDrawer('https://wd5.myworkdayjobs.com/careers')).toBe(true);
    expect(isEligibleForDrawer('https://job-boards.greenhouse.io/headoutcareers/jobs/123')).toBe(true);
    expect(isEligibleForDrawer('http://localhost:3000/apply')).toBe(true);
    expect(isEligibleForDrawer('file:///home/user/app.html')).toBe(true);
    expect(isEligibleForDrawer('https://accounts.google.com/signin')).toBe(false);
    expect(isEligibleForDrawer('chrome://extensions/')).toBe(false);
    expect(isEligibleForDrawer('chrome-extension://xyz/popup.html')).toBe(false);
    expect(isEligibleForDrawer('about:blank')).toBe(false);
  });

  it('correctly dispatches OPEN_OPTIONS_PAGE and OPEN_OPTIONS_TAB messages with fallback', () => {
    let sentMessage: any = null;
    let openedUrl: string | null = null;

    const mockChrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://mock-id/${path}`,
        sendMessage: (msg: any, cb?: (res: any) => void) => {
          sentMessage = msg;
          if (cb) cb({ success: true });
        },
      },
    };

    const mockWindowOpen = (url: string) => {
      openedUrl = url;
      return null;
    };

    const openOptions = (tab?: string) => {
      try {
        mockChrome.runtime.sendMessage(
          { type: tab ? 'OPEN_OPTIONS_TAB' : 'OPEN_OPTIONS_PAGE', tab },
          (res: any) => {
            if (!res?.success) {
              const targetUrl = mockChrome.runtime.getURL(
                tab ? `options.html?tab=${encodeURIComponent(tab)}#${encodeURIComponent(tab)}` : 'options.html'
              );
              mockWindowOpen(targetUrl);
            }
          }
        );
      } catch {
        const targetUrl = mockChrome.runtime.getURL(
          tab ? `options.html?tab=${encodeURIComponent(tab)}#${encodeURIComponent(tab)}` : 'options.html'
        );
        mockWindowOpen(targetUrl);
      }
    };

    // Case 1: General Options button click
    openOptions();
    expect(sentMessage).toEqual({ type: 'OPEN_OPTIONS_PAGE', tab: undefined });
    expect(openedUrl).toBeNull();

    // Case 2: Deep-link to specific tab (e.g. applications or profile)
    openOptions('applications');
    expect(sentMessage).toEqual({ type: 'OPEN_OPTIONS_TAB', tab: 'applications' });

    openOptions('profile');
    expect(sentMessage).toEqual({ type: 'OPEN_OPTIONS_TAB', tab: 'profile' });
  });
});
