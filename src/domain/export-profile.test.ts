import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_PROFILE,
  formatTagsInput,
  normalizeExportProfile,
  parseTagsInput,
} from './export-profile';

describe('DEFAULT_EXPORT_PROFILE', () => {
  it('starts with a ChatGPT tag', () => {
    expect(DEFAULT_EXPORT_PROFILE.defaultTags).toEqual(['chatgpt']);
  });

  it('normalizes persisted profile values and removes duplicate tags', () => {
    expect(
      normalizeExportProfile({
        vault: '  Personal notes ',
        folder: ' Imports/ChatGPT ',
        defaultTags: [' chatgpt ', '', 'reference', 'chatgpt'],
        ignored: true,
      }),
    ).toEqual({
      vault: 'Personal notes',
      folder: 'Imports/ChatGPT',
      defaultTags: ['chatgpt', 'reference'],
    });
  });

  it('uses safe defaults for malformed stored data', () => {
    expect(normalizeExportProfile({ vault: 42, defaultTags: 'chatgpt' })).toEqual({
      vault: '',
      folder: '',
      defaultTags: ['chatgpt'],
    });
  });

  it('parses and formats a comma-separated tags field', () => {
    expect(parseTagsInput(' chatgpt, reference, chatgpt,  ')).toEqual([
      'chatgpt',
      'reference',
    ]);
    expect(formatTagsInput(['chatgpt', 'reference'])).toBe('chatgpt, reference');
  });
});
