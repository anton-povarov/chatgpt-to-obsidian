import { describe, expect, it, vi } from 'vitest';

import {
  EXPORT_PROFILE_STORAGE_KEY,
  loadExportProfile,
  saveExportProfile,
  type ProfileStorageArea,
} from './export-profile-storage';

describe('Export Profile storage', () => {
  it('loads and normalizes the stored profile', async () => {
    const storage = fakeStorage({
      [EXPORT_PROFILE_STORAGE_KEY]: {
        vault: ' Personal ',
        folder: ' ChatGPT ',
        defaultTags: [' chatgpt ', 'reference'],
      },
    });

    await expect(loadExportProfile(storage)).resolves.toEqual({
      vault: 'Personal',
      folder: 'ChatGPT',
      defaultTags: ['chatgpt', 'reference'],
    });
  });

  it('saves only normalized profile fields', async () => {
    const storage = fakeStorage({});

    await saveExportProfile(
      {
        vault: ' Personal ',
        folder: ' Imports ',
        defaultTags: ['chatgpt', ' chatgpt ', ''],
      },
      storage,
    );

    expect(storage.set).toHaveBeenCalledWith({
      [EXPORT_PROFILE_STORAGE_KEY]: {
        vault: 'Personal',
        folder: 'Imports',
        defaultTags: ['chatgpt'],
      },
    });
  });
});

function fakeStorage(initial: Record<string, unknown>): ProfileStorageArea {
  return {
    get: vi.fn(async () => initial),
    set: vi.fn(async () => undefined),
  };
}
