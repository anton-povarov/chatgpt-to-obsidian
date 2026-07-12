export const INITIAL_CONVERSATION_TAGS: readonly string[] = Object.freeze(['chatgpt']);

export function parseTagsInput(value: string): string[] {
  const uniqueTags = new Set<string>();
  for (const tag of value.split(',')) {
    const normalized = tag.trim();
    if (normalized) {
      uniqueTags.add(normalized);
    }
  }
  return [...uniqueTags];
}

export function formatTagsInput(tags: readonly string[]): string {
  return tags.join(', ');
}
