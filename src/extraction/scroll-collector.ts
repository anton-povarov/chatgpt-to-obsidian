export interface ScrollCollectionProgress {
  itemsCollected: number;
  newItems: number;
  position: number;
  maximumPosition: number;
  pass: number;
  stablePasses: number;
  reachedEnd: boolean;
  elapsedMs: number;
}

export interface ScrollCollectionAdapter<T> {
  getPosition(): number;
  getMaximumPosition(): number;
  getViewportSize(): number;
  scrollTo(position: number): void;
  collectItems(): T[];
  getItemKey(item: T): string;
  compareItems?(left: T, right: T): number;
  waitForRender(): Promise<void>;
}

export interface ScrollCollectionOptions {
  timeoutMs?: number;
  stablePasses?: number;
  maxPasses?: number;
  signal?: AbortSignal;
  now?: () => number;
  onProgress?: (progress: ScrollCollectionProgress) => void;
}

export interface ScrollCollectionOutcome<T> {
  items: T[];
  stabilized: boolean;
  timedOut: boolean;
  cancelled: boolean;
  failure?: string;
  restorationFailure?: string;
  diagnostics: ScrollCollectionDiagnostics;
}

export interface ScrollCollectionDiagnostics {
  termination: 'stabilized' | 'timed-out' | 'cancelled' | 'failed';
  elapsedMs: number;
  passes: number;
  initialItems: number;
  traversedItems: number;
  finalItems: number;
  originalPosition: number;
  originalMaximumPosition: number;
  lastPosition: number;
  lastMaximumPosition: number;
  restoredPosition: number;
  restoredMaximumPosition: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_STABLE_PASSES = 2;
const DEFAULT_MAX_PASSES = 200;

export async function collectByScrolling<T>(
  adapter: ScrollCollectionAdapter<T>,
  options: ScrollCollectionOptions = {},
): Promise<ScrollCollectionOutcome<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requiredStablePasses = options.stablePasses ?? DEFAULT_STABLE_PASSES;
  const maxPasses = options.maxPasses ?? DEFAULT_MAX_PASSES;
  const now = options.now ?? Date.now;
  const originalPosition = adapter.getPosition();
  const originalMaximumPosition = Math.max(0, adapter.getMaximumPosition());
  const originalWasAtEnd = originalPosition >= originalMaximumPosition - 1;
  const startedAt = now();
  const collected = new Map<string, T>();
  let stabilized = false;
  let timedOut = false;
  let cancelled = false;
  let failure: string | undefined;
  let restorationFailure: string | undefined;
  let initiallyVisible: T[] = [];
  let passes = 0;
  let lastPosition = originalPosition;
  let lastMaximumPosition = originalMaximumPosition;

  try {
    // Preserve the current viewport before moving it. A virtualized page may
    // remove these nodes and never render them again during the downward pass.
    initiallyVisible = adapter.collectItems();
    adapter.scrollTo(0);
    await adapter.waitForRender();

    let stablePassCount = 0;

    for (let pass = 1; pass <= maxPasses; pass += 1) {
      passes = pass;
      if (options.signal?.aborted) {
        cancelled = true;
        break;
      }

      const sizeBeforeCollection = collected.size;
      for (const item of adapter.collectItems()) {
        const key = adapter.getItemKey(item);
        // Refresh an existing entry as well: a visible assistant response can
        // continue rendering while the collector advances through the page.
        collected.set(key, item);
      }

      const position = adapter.getPosition();
      const maximumPosition = Math.max(0, adapter.getMaximumPosition());
      const reachedEnd = position >= maximumPosition - 1;
      const foundNewItems = collected.size > sizeBeforeCollection;
      lastPosition = position;
      lastMaximumPosition = maximumPosition;

      stablePassCount = reachedEnd && !foundNewItems ? stablePassCount + 1 : 0;

      options.onProgress?.({
        itemsCollected: collected.size,
        newItems: collected.size - sizeBeforeCollection,
        position,
        maximumPosition,
        pass,
        stablePasses: stablePassCount,
        reachedEnd,
        elapsedMs: now() - startedAt,
      });

      if (stablePassCount >= requiredStablePasses) {
        stabilized = true;
        break;
      }

      if (now() - startedAt >= timeoutMs) {
        timedOut = true;
        break;
      }

      const step = Math.max(1, Math.floor(adapter.getViewportSize() * 0.8));
      adapter.scrollTo(reachedEnd ? maximumPosition : Math.min(position + step, maximumPosition));
      await adapter.waitForRender();
    }

    if (!stabilized && !timedOut && !cancelled) {
      failure = `Collection did not stabilize after ${maxPasses} passes.`;
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Automatic scrolling failed.';

    if (collected.size === 0) {
      try {
        for (const item of adapter.collectItems()) {
          collected.set(adapter.getItemKey(item), item);
        }
      } catch {
        // Retain the original failure. There is no useful fallback content to add.
      }
    }
  } finally {
    try {
      const currentMaximumPosition = Math.max(0, adapter.getMaximumPosition());
      adapter.scrollTo(
        originalWasAtEnd ? currentMaximumPosition : Math.min(originalPosition, currentMaximumPosition),
      );
    } catch (error) {
      restorationFailure =
        error instanceof Error ? error.message : 'The original scroll position could not be restored.';
    }
  }

  const traversedItems = collected.size;
  for (const item of initiallyVisible) {
    const key = adapter.getItemKey(item);
    if (!collected.has(key)) {
      collected.set(key, item);
    }
  }

  const items = [...collected.values()];
  if (adapter.compareItems) {
    items.sort(adapter.compareItems);
  }

  const restoredPosition = adapter.getPosition();
  const restoredMaximumPosition = Math.max(0, adapter.getMaximumPosition());
  const termination = stabilized
    ? 'stabilized'
    : timedOut
      ? 'timed-out'
      : cancelled
        ? 'cancelled'
        : 'failed';

  return {
    items,
    stabilized: stabilized && !restorationFailure,
    timedOut,
    cancelled,
    failure,
    restorationFailure,
    diagnostics: {
      termination,
      elapsedMs: now() - startedAt,
      passes,
      initialItems: initiallyVisible.length,
      traversedItems,
      finalItems: items.length,
      originalPosition,
      originalMaximumPosition,
      lastPosition,
      lastMaximumPosition,
      restoredPosition,
      restoredMaximumPosition,
    },
  };
}
