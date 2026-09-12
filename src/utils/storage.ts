import { StorageData, defaultStorageData } from '../types/storage';

export async function getStorageData(): Promise<StorageData> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('quickfiller_storage') : null;
      return local ? { ...defaultStorageData, ...JSON.parse(local) } : defaultStorageData;
    } catch {
      return defaultStorageData;
    }
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      resolve({
        profile: result.profile || defaultStorageData.profile,
        wizardAnswers: result.wizardAnswers || defaultStorageData.wizardAnswers,
        questionBank: result.questionBank || defaultStorageData.questionBank,
        llmSettings: result.llmSettings || defaultStorageData.llmSettings,
        extensionEnabled: result.extensionEnabled ?? defaultStorageData.extensionEnabled,
      });
    });
  });
}

export async function updateStorageData(partial: Partial<StorageData>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    try {
      const current = await getStorageData();
      const updated = { ...current, ...partial };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('quickfiller_storage', JSON.stringify(updated));
      }
    } catch {
      // Ignore fallback errors
    }
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set(partial, () => {
      resolve();
    });
  });
}
