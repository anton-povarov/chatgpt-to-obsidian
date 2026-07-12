import { describe, expect, it } from 'vitest';

import {
  INITIAL_CONVERSATION_TAGS,
  formatTagsInput,
  parseTagsInput,
} from './conversation-tags';

describe('Conversation tags', () => {
  it('starts every document with only the hardcoded ChatGPT tag', () => {
    expect(INITIAL_CONVERSATION_TAGS).toEqual(['chatgpt']);
  });

  it('parses and formats comma-separated current-document tags', () => {
    expect(parseTagsInput(' chatgpt, reference, chatgpt,  ')).toEqual([
      'chatgpt',
      'reference',
    ]);
    expect(formatTagsInput(['chatgpt', 'reference'])).toBe('chatgpt, reference');
  });
});
