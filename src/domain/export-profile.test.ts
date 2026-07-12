import { describe, expect, it } from 'vitest';

import { DEFAULT_EXPORT_PROFILE } from './export-profile';

describe('DEFAULT_EXPORT_PROFILE', () => {
  it('links images by default', () => {
    expect(DEFAULT_EXPORT_PROFILE.downloadImages).toBe(false);
  });

  it('starts with a ChatGPT tag', () => {
    expect(DEFAULT_EXPORT_PROFILE.defaultTags).toEqual(['chatgpt']);
  });
});
