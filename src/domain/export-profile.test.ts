import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_PROFILE,
  normalizeExportProfile,
} from './export-profile';

describe('DEFAULT_EXPORT_PROFILE', () => {
  it('contains only persistent vault destination fields', () => {
    expect(DEFAULT_EXPORT_PROFILE).toEqual({ vault: '', folder: '' });
  });

  it('normalizes persisted profile values and ignores legacy default tags', () => {
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
    });
  });

  it('uses safe defaults for malformed stored data', () => {
    expect(normalizeExportProfile({ vault: 42, defaultTags: 'chatgpt' })).toEqual({
      vault: '',
      folder: '',
    });
  });
});
