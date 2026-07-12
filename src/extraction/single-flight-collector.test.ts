import { describe, expect, it, vi } from 'vitest';

import { singleFlightCollector } from './single-flight-collector';

describe('singleFlightCollector', () => {
  it('shares one active collection across concurrent callers', async () => {
    let resolveCollection: ((value: string) => void) | undefined;
    const collect = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveCollection = resolve;
        }),
    );
    const coordinatedCollect = singleFlightCollector(collect);

    const first = coordinatedCollect();
    const duplicate = coordinatedCollect();

    expect(collect).toHaveBeenCalledTimes(1);
    expect(duplicate).toBe(first);

    resolveCollection?.('collected');
    await expect(first).resolves.toBe('collected');

    const next = coordinatedCollect();
    expect(collect).toHaveBeenCalledTimes(2);
    resolveCollection?.('collected again');
    await expect(next).resolves.toBe('collected again');
  });

  it('allows another collection after a failure', async () => {
    const collect = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce('recovered');
    const coordinatedCollect = singleFlightCollector(collect);

    await expect(coordinatedCollect()).rejects.toThrow('failed');
    await expect(coordinatedCollect()).resolves.toBe('recovered');
    expect(collect).toHaveBeenCalledTimes(2);
  });
});
