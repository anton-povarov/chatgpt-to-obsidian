import { describe, expect, it } from 'vitest';

import {
  collectByScrolling,
  type ScrollCollectionAdapter,
} from './scroll-collector';

interface TestItem {
  id: string;
  order?: number;
  value?: string;
}

function createAdapter(itemsAtPosition: Record<number, TestItem[]>, originalPosition = 40) {
  let position = originalPosition;
  const visited: number[] = [];
  const adapter: ScrollCollectionAdapter<TestItem> = {
    getPosition: () => position,
    getMaximumPosition: () => 100,
    getViewportSize: () => 50,
    scrollTo: (nextPosition) => {
      position = nextPosition;
      visited.push(nextPosition);
    },
    collectItems: () => itemsAtPosition[position] ?? [],
    getItemKey: (item) => item.id,
    waitForRender: async () => undefined,
  };

  return { adapter, getPosition: () => position, visited };
}

describe('collectByScrolling', () => {
  it('converges at the end of the scroll range', async () => {
    const { adapter, getPosition } = createAdapter({
      0: [{ id: 'one' }],
      40: [{ id: 'two' }],
      80: [{ id: 'three' }],
      100: [{ id: 'four' }],
    });

    const outcome = await collectByScrolling(adapter);

    expect(outcome.stabilized).toBe(true);
    expect(outcome.items.map((item) => item.id)).toEqual(['one', 'two', 'three', 'four']);
    expect(getPosition()).toBe(40);
    expect(outcome.diagnostics).toMatchObject({
      termination: 'stabilized',
      initialItems: 1,
      traversedItems: 4,
      finalItems: 4,
      originalPosition: 40,
      originalMaximumPosition: 100,
      lastPosition: 100,
      lastMaximumPosition: 100,
      restoredPosition: 40,
      restoredMaximumPosition: 100,
    });
  });

  it('deduplicates items visible at adjacent scroll positions', async () => {
    const { adapter } = createAdapter({
      0: [{ id: 'one' }, { id: 'two', value: 'earlier render' }],
      40: [{ id: 'two', value: 'latest render' }, { id: 'three' }],
      80: [{ id: 'three' }],
      100: [{ id: 'three' }],
    });

    const outcome = await collectByScrolling(adapter);

    expect(outcome.items.map((item) => item.id)).toEqual(['one', 'two', 'three']);
    expect(outcome.items.find((item) => item.id === 'two')?.value).toBe('latest render');
  });

  it('returns partial content when the timeout is reached', async () => {
    const { adapter } = createAdapter({ 0: [{ id: 'one' }], 40: [{ id: 'two' }] });
    let elapsed = 0;

    const outcome = await collectByScrolling(adapter, {
      now: () => {
        elapsed += 25;
        return elapsed;
      },
      timeoutMs: 20,
    });

    expect(outcome.stabilized).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.items).toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(outcome.diagnostics.termination).toBe('timed-out');
  });

  it('preserves and orders an initial virtualized viewport that never renders again', async () => {
    let position = 100;
    let initialCollection = true;
    const adapter: ScrollCollectionAdapter<TestItem> = {
      getPosition: () => position,
      getMaximumPosition: () => 100,
      getViewportSize: () => 100,
      scrollTo: (nextPosition) => {
        position = nextPosition;
      },
      collectItems: () => {
        if (initialCollection) {
          initialCollection = false;
          return [{ id: 'tail', order: 3 }];
        }
        return position === 0
          ? [
              { id: 'first', order: 1 },
              { id: 'middle', order: 2 },
            ]
          : [];
      },
      getItemKey: (item) => item.id,
      compareItems: (left, right) => (left.order ?? 0) - (right.order ?? 0),
      waitForRender: async () => undefined,
    };

    const outcome = await collectByScrolling(adapter);

    expect(outcome.items.map((item) => item.id)).toEqual(['first', 'middle', 'tail']);
    expect(position).toBe(100);
    expect(outcome.diagnostics).toMatchObject({
      initialItems: 1,
      traversedItems: 2,
      finalItems: 3,
    });
  });

  it('restores the original position after failure and cancellation', async () => {
    const failed = createAdapter({}, 60);
    failed.adapter.collectItems = () => {
      throw new Error('render failed');
    };

    const failedOutcome = await collectByScrolling(failed.adapter);
    expect(failedOutcome.failure).toBe('render failed');
    expect(failed.getPosition()).toBe(60);

    const cancelled = createAdapter({}, 70);
    const controller = new AbortController();
    controller.abort();

    const cancelledOutcome = await collectByScrolling(cancelled.adapter, {
      signal: controller.signal,
    });
    expect(cancelledOutcome.cancelled).toBe(true);
    expect(cancelled.getPosition()).toBe(70);
  });

  it('restores the semantic bottom when the scroll range grows', async () => {
    let position = 100;
    let maximumPosition = 100;
    const adapter: ScrollCollectionAdapter<TestItem> = {
      getPosition: () => position,
      getMaximumPosition: () => maximumPosition,
      getViewportSize: () => 100,
      scrollTo: (nextPosition) => {
        position = nextPosition;
        if (nextPosition === 0) {
          maximumPosition = 200;
        }
      },
      collectItems: () => [{ id: `item-${position}` }],
      getItemKey: (item) => item.id,
      waitForRender: async () => undefined,
    };

    const outcome = await collectByScrolling(adapter);

    expect(position).toBe(200);
    expect(outcome.diagnostics).toMatchObject({
      originalPosition: 100,
      originalMaximumPosition: 100,
      restoredPosition: 200,
      restoredMaximumPosition: 200,
    });
  });
});
