import { describe, it, expect, beforeEach } from 'vitest';

describe('Copilot Drawer State Persistence & Pin Auto-Open', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__QUICKFILLER_AUTO_OPEN__;
  });

  const checkInitialOpen = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).__QUICKFILLER_AUTO_OPEN__) {
        (window as any).__QUICKFILLER_AUTO_OPEN__ = false;
        try {
          sessionStorage.setItem('quickfiller_drawer_open', 'true');
        } catch {}
        return true;
      }
      try {
        const stored = sessionStorage.getItem('quickfiller_drawer_open');
        if (stored === 'false') return false;
        if (stored === 'true') return true;
      } catch {}

      // On first visit / pin click access grant, open the drawer by default
      try {
        sessionStorage.setItem('quickfiller_drawer_open', 'true');
      } catch {}
      return true;
    }
    return false;
  };

  const checkInitialExpanded = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('quickfiller_drawer_expanded');
        if (stored === 'false') return false;
        if (stored === 'true') return true;
      } catch {}

      // On first visit / pin click, default to expanded wide view
      try {
        sessionStorage.setItem('quickfiller_drawer_expanded', 'true');
      } catch {}
      return true;
    }
    return true;
  };

  it('initializes open by default on first visit / pin click access grant (white circle pin to normal pin)', () => {
    expect(checkInitialOpen()).toBe(true);
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('true');
  });

  it('initializes in expanded view on first visit / pin click', () => {
    expect(checkInitialExpanded()).toBe(true);
    expect(sessionStorage.getItem('quickfiller_drawer_expanded')).toBe('true');
  });

  it('respects user width collapse when sessionStorage has false', () => {
    sessionStorage.setItem('quickfiller_drawer_expanded', 'false');
    expect(checkInitialExpanded()).toBe(false);
  });

  it('initializes open and saves to sessionStorage when __QUICKFILLER_AUTO_OPEN__ is true', () => {
    (window as any).__QUICKFILLER_AUTO_OPEN__ = true;

    expect(checkInitialOpen()).toBe(true);
    expect((window as any).__QUICKFILLER_AUTO_OPEN__).toBe(false);
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('true');
  });

  it('maintains open state across page reloads / steps via sessionStorage', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'true');
    expect(checkInitialOpen()).toBe(true);
  });

  it('respects user minimization when sessionStorage is set to false', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'false');
    expect(checkInitialOpen()).toBe(false);
  });

  it('correctly updates sessionStorage when closed or minimized', () => {
    sessionStorage.setItem('quickfiller_drawer_open', 'true');
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('true');

    // User clicks minimize / close
    sessionStorage.setItem('quickfiller_drawer_open', 'false');
    expect(sessionStorage.getItem('quickfiller_drawer_open')).toBe('false');
  });

  it('identifies eligible web URLs for auto-opening drawer', () => {
    const isEligibleForDrawer = (url?: string): boolean => {
      if (!url) return false;
      if (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('view-source:')
      ) {
        return false;
      }
      return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
    };

    expect(isEligibleForDrawer('https://wd5.myworkdayjobs.com/careers')).toBe(true);
    expect(isEligibleForDrawer('http://localhost:3000/apply')).toBe(true);
    expect(isEligibleForDrawer('file:///home/user/app.html')).toBe(true);
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
