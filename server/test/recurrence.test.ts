import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '../src/services/recurrence.js';

describe('nextOccurrence', () => {
  it('daily adds one day', () => {
    expect(nextOccurrence(new Date('2026-01-01T09:00:00Z'), 'daily')?.toISOString()).toBe('2026-01-02T09:00:00.000Z');
  });
  it('weekdays skips the weekend', () => {
    // 2026-01-02 is a Friday
    expect(nextOccurrence(new Date('2026-01-02T09:00:00Z'), 'weekdays')?.toISOString()).toBe('2026-01-05T09:00:00.000Z');
  });
  it('monthly clamps to month end', () => {
    expect(nextOccurrence(new Date('2026-01-31T09:00:00Z'), 'monthly')?.toISOString()).toBe('2026-02-28T09:00:00.000Z');
  });
  it('none returns null', () => {
    expect(nextOccurrence(new Date(), 'none')).toBeNull();
  });
});
