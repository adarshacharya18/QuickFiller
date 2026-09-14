export let mockChromeStorage: Record<string, any> = {};

export function resetMockChromeStorage(initial: Record<string, any> = {}) {
  mockChromeStorage = { ...initial };
}

export let mockDynamicRules: any[] = [];
export let mockRemovedRuleIds: number[] = [];

export function resetMockDynamicRules() {
  mockDynamicRules = [];
  mockRemovedRuleIds = [];
}

(globalThis as any).chrome = {
  runtime: {
    id: 'mock-quickfiller-id',
    getURL: (path: string = '') => `chrome-extension://mock-quickfiller-id/${path.replace(/^\//, '')}`,
  },
  declarativeNetRequest: {
    updateDynamicRules: async (options: { removeRuleIds?: number[]; addRules?: any[] }) => {
      if (options.removeRuleIds) {
        mockRemovedRuleIds.push(...options.removeRuleIds);
        mockDynamicRules = mockDynamicRules.filter((r) => !options.removeRuleIds?.includes(r.id));
      }
      if (options.addRules) {
        mockDynamicRules.push(...options.addRules);
      }
    },
    getDynamicRules: async () => mockDynamicRules,
  },
  storage: {
    local: {
      get: (keys: any, cb: (res: any) => void) => {
        if (!keys) {
          cb({ ...mockChromeStorage });
        } else if (typeof keys === 'string') {
          cb({ [keys]: mockChromeStorage[keys] });
        } else if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          for (const k of keys) res[k] = mockChromeStorage[k];
          cb(res);
        } else {
          cb({ ...mockChromeStorage });
        }
      },
      set: (items: Record<string, any>, cb?: () => void) => {
        Object.assign(mockChromeStorage, items);
        if (cb) cb();
      },
      remove: (keys: string | string[], cb?: () => void) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) delete mockChromeStorage[k];
        if (cb) cb();
      },
      clear: (cb?: () => void) => {
        mockChromeStorage = {};
        if (cb) cb();
      },
    },
  },
};
