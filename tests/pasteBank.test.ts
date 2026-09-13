import { describe, it, expect, beforeEach } from 'vitest';
import { getStorageData, updateStorageData } from '../src/utils/storage';
import { CustomPasteItem } from '../src/types/storage';
import { insertTextAtCursor } from '../src/utils/autofill';
import { resetMockChromeStorage } from './setup';

describe('Custom Paste Bank & Snippets Engine', () => {
  beforeEach(() => {
    resetMockChromeStorage();
    document.body.innerHTML = '';
  });

  it('adds and retrieves custom paste snippets', async () => {
    const item: CustomPasteItem = {
      id: 'snippet_1',
      label: 'Notice Period',
      value: 'Immediately available (0 days notice period)',
    };

    await updateStorageData({ customPasteBank: [item] });

    const data = await getStorageData();
    expect(data.customPasteBank.length).toBe(1);
    expect(data.customPasteBank[0].label).toBe('Notice Period');
    expect(data.customPasteBank[0].value).toBe('Immediately available (0 days notice period)');
  });

  it('inserts snippet value directly into focused form textarea', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const snippetValue = 'I am authorized to work in India without requiring visa sponsorship.';
    const inserted = insertTextAtCursor(snippetValue, textarea);

    expect(inserted).toBe(true);
    expect(textarea.value).toBe(snippetValue);
  });

  it('filters and searches paste items by query', async () => {
    const items: CustomPasteItem[] = [
      { id: '1', label: 'Salary Expectation', value: 'INR 25,00,000 / year' },
      { id: '2', label: 'Work Authorization', value: 'Citizen, no sponsorship needed' },
      { id: '3', label: 'Earliest Start Date', value: 'Within 2 weeks' },
    ];

    await updateStorageData({ customPasteBank: items });
    const data = await getStorageData();

    const query = 'salary';
    const matches = data.customPasteBank.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.value.toLowerCase().includes(query.toLowerCase())
    );

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('1');
  });
});
