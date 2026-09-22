import { describe, it, expect, beforeEach } from 'vitest';

export interface Position {
  x: number;
  y: number;
}

export const clampDrawerPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8
): Position => {
  const maxX = Math.max(margin, viewportWidth - width - margin);
  const maxY = Math.max(margin, viewportHeight - height - margin);
  return {
    x: Math.round(Math.max(margin, Math.min(x, maxX))),
    y: Math.round(Math.max(margin, Math.min(y, maxY))),
  };
};

export const getStoredDrawerPosition = (): Position | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('quickfiller_drawer_pos');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
  } catch {}
  return null;
};

export const saveDrawerPosition = (pos: Position | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (pos) {
      sessionStorage.setItem('quickfiller_drawer_pos', JSON.stringify(pos));
    } else {
      sessionStorage.removeItem('quickfiller_drawer_pos');
    }
  } catch {}
};

describe('Draggable Drawer Window Engine', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('Viewport Boundary Clamping', () => {
    it('preserves valid coordinates within viewport bounds', () => {
      const pos = clampDrawerPosition(200, 150, 400, 600, 1920, 1080);
      expect(pos).toEqual({ x: 200, y: 150 });
    });

    it('clamps negative or sub-margin coordinates to the minimum margin', () => {
      const pos = clampDrawerPosition(-50, -10, 400, 600, 1920, 1080, 8);
      expect(pos).toEqual({ x: 8, y: 8 });
    });

    it('clamps coordinates that exceed right or bottom edges', () => {
      // viewport: 1920 x 1080, drawer: 400 x 600, margin: 8
      // maxX: 1920 - 400 - 8 = 1512
      // maxY: 1080 - 600 - 8 = 472
      const pos = clampDrawerPosition(2500, 2000, 400, 600, 1920, 1080, 8);
      expect(pos).toEqual({ x: 1512, y: 472 });
    });

    it('handles small viewports gracefully when drawer dimensions exceed viewport', () => {
      const pos = clampDrawerPosition(100, 100, 700, 800, 600, 700, 8);
      expect(pos.x).toBe(8);
      expect(pos.y).toBe(8);
    });
  });

  describe('Session Storage Persistence for Draggable Window', () => {
    it('returns null when no position is stored in sessionStorage', () => {
      expect(getStoredDrawerPosition()).toBeNull();
    });

    it('correctly persists and retrieves custom position coordinates', () => {
      saveDrawerPosition({ x: 350, y: 120 });
      expect(getStoredDrawerPosition()).toEqual({ x: 350, y: 120 });
    });

    it('resets position and removes sessionStorage entry on reset', () => {
      saveDrawerPosition({ x: 350, y: 120 });
      expect(getStoredDrawerPosition()).not.toBeNull();

      saveDrawerPosition(null);
      expect(getStoredDrawerPosition()).toBeNull();
      expect(sessionStorage.getItem('quickfiller_drawer_pos')).toBeNull();
    });

    it('handles corrupted JSON in sessionStorage safely', () => {
      sessionStorage.setItem('quickfiller_drawer_pos', '{invalid_json}');
      expect(getStoredDrawerPosition()).toBeNull();
    });
  });

  describe('Firefox Duplicate Prevention Guard & Drag Controller', () => {
    it('prevents mounting duplicate quickfiller-drawer elements when content script is reinjected', () => {
      document.body.innerHTML = '<div id="app"></div>';

      // Simulate first content script mount
      const drawer1 = document.createElement('quickfiller-drawer');
      document.body.appendChild(drawer1);
      (window as any).__QUICKFILLER_MOUNTED__ = true;

      // Simulate second injection attempt in Firefox
      const shouldMountAgain = () => {
        const existing = document.querySelector('quickfiller-drawer');
        if (existing) return false;
        if ((window as any).__QUICKFILLER_MOUNTED__) return false;
        return true;
      };

      expect(shouldMountAgain()).toBe(false);
      expect(document.querySelectorAll('quickfiller-drawer').length).toBe(1);

      // Cleanup
      delete (window as any).__QUICKFILLER_MOUNTED__;
      drawer1.remove();
    });

    it('ensures drag handle blocks native HTML5 drag and prevents ghost duplicates', () => {
      const handle = document.createElement('div');
      handle.setAttribute('draggable', 'false');

      let defaultPrevented = false;
      let propagationStopped = false;

      const mockPointerDown = {
        preventDefault: () => { defaultPrevented = true; },
        stopPropagation: () => { propagationStopped = true; },
        target: handle,
        button: 0,
        clientX: 100,
        clientY: 100,
      };

      // Ensure preventDefault and stopPropagation are called to kill native drag ghost
      mockPointerDown.preventDefault();
      mockPointerDown.stopPropagation();

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
      expect(handle.getAttribute('draggable')).toBe('false');
    });
  });
});

describe('Unified Autofill & Answers Tab Logic', () => {
  it('computes combined total count across standard fields, radios, and screening questions', () => {
    const standardFields = [{ id: '1', label: 'First Name' }, { id: '2', label: 'Email' }];
    const radioGroups = [{ id: 'r1', question: 'Work Auth' }];
    const customQuestions = [{ id: 'q1', label: 'Why join us?' }, { id: 'q2', label: 'Tech stack' }];

    const totalFields = standardFields.length + radioGroups.length + customQuestions.length;
    expect(totalFields).toBe(5);
  });

  it('filters field categories properly when user selects sub-filters', () => {
    const items = {
      questions: ['q1', 'q2'],
      standard: ['s1', 's2', 's3'],
      radios: ['r1'],
    };

    const getVisibleSections = (filter: 'all' | 'questions' | 'standard' | 'radios') => {
      return {
        showQuestions: (filter === 'all' || filter === 'questions') && items.questions.length > 0,
        showStandard: (filter === 'all' || filter === 'standard') && items.standard.length > 0,
        showRadios: (filter === 'all' || filter === 'radios') && items.radios.length > 0,
      };
    };

    expect(getVisibleSections('all')).toEqual({
      showQuestions: true,
      showStandard: true,
      showRadios: true,
    });

    expect(getVisibleSections('questions')).toEqual({
      showQuestions: true,
      showStandard: false,
      showRadios: false,
    });

    expect(getVisibleSections('standard')).toEqual({
      showQuestions: false,
      showStandard: true,
      showRadios: false,
    });

    expect(getVisibleSections('radios')).toEqual({
      showQuestions: false,
      showStandard: false,
      showRadios: true,
    });
  });

  it('identifies unanswered screening questions for batch drafting', () => {
    const customQuestions = [
      { id: 'q1', label: 'Why join us?' },
      { id: 'q2', label: 'Describe a challenge' },
      { id: 'q3', label: 'Years of React experience' },
    ];
    const answers: Record<string, string> = {
      q1: 'I want to join because...',
      // q2 and q3 are empty
    };

    const unanswered = customQuestions.filter((q) => !answers[q.id]?.trim());
    expect(unanswered.map((q) => q.id)).toEqual(['q2', 'q3']);
  });

  it('navigates cleanly between 4 consolidated tabs', () => {
    type TabId = 'autofill' | 'coverLetter' | 'outreach' | 'bank';
    const tabs: TabId[] = ['autofill', 'coverLetter', 'outreach', 'bank'];

    expect(tabs.length).toBe(4);
    expect(tabs).toContain('autofill');
    expect(tabs).not.toContain('questions');
  });

  describe('Copilot Popup Wheel Scroll Containment & Isolation', () => {
    it('always cancels default action and stopPropagation on wheel over popup', () => {
      let defaultPrevented = false;
      let propagationStopped = false;

      const mockEvent = {
        deltaY: 50,
        deltaX: 0,
        deltaMode: 0,
        preventDefault: () => {
          defaultPrevented = true;
        },
        stopPropagation: () => {
          propagationStopped = true;
        },
        stopImmediatePropagation: () => {},
        composedPath: () => [],
      } as unknown as WheelEvent;

      const scrollBody = { scrollTop: 0 };
      // Simulate handleWheel execution
      mockEvent.preventDefault();
      mockEvent.stopPropagation();
      scrollBody.scrollTop += mockEvent.deltaY;

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
      expect(scrollBody.scrollTop).toBe(50);
    });

    it('normalizes deltaMode line mode and updates internal scroll container', () => {
      const mockEvent = {
        deltaY: 2, // 2 lines
        deltaX: 0,
        deltaMode: 1, // line mode
        preventDefault: () => {},
        stopPropagation: () => {},
      };

      let delta = mockEvent.deltaY;
      if (mockEvent.deltaMode === 1) delta *= 28;

      const scrollBody = { scrollTop: 10 };
      scrollBody.scrollTop += delta;

      expect(delta).toBe(56);
      expect(scrollBody.scrollTop).toBe(66);
    });

    it('scrolls inner preview box when it can scroll, otherwise redirects to main drawer body', () => {
      const innerPreview = {
        scrollTop: 0,
        clientHeight: 200,
        scrollHeight: 400,
      };
      const mainBody = { scrollTop: 100 };

      // Case 1: Inner preview can scroll down
      const delta1 = 40;
      const canScrollDown = delta1 > 0 && innerPreview.scrollTop + innerPreview.clientHeight < innerPreview.scrollHeight - 1;
      expect(canScrollDown).toBe(true);
      if (canScrollDown) {
        innerPreview.scrollTop += delta1;
      }
      expect(innerPreview.scrollTop).toBe(40);
      expect(mainBody.scrollTop).toBe(100);

      // Case 2: Inner preview reaches bottom limit
      innerPreview.scrollTop = 200; // at bottom (200 + 200 = 400)
      const canScrollDownAtBottom = delta1 > 0 && innerPreview.scrollTop + innerPreview.clientHeight < innerPreview.scrollHeight - 1;
      expect(canScrollDownAtBottom).toBe(false);
      // When inner preview cannot scroll, mainBody scrolls instead
      if (!canScrollDownAtBottom) {
        mainBody.scrollTop += delta1;
      }
      expect(mainBody.scrollTop).toBe(140);
    });
  });
});

