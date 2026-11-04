/** Per-hook request fence; obsolete callbacks cannot cancel a newer unit's request. */
export function createSubscriptionFence<T>() {
  let scope: T | null = null, sequence = 0;
  return {
    select(value: T) { scope = value; },
    cancel(value: T) { if (scope === value) { scope = null; ++sequence; } },
    begin(value: T): (() => boolean) | null {
      if (scope !== value) return null;
      const request = ++sequence;
      return () => scope === value && request === sequence;
    },
  };
}
