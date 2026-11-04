export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

/** Returns the next due date for a recurring task, or null for non-recurring tasks. */
export function nextOccurrence(from: Date, recurrence: Recurrence): Date | null {
  const d = new Date(from);
  switch (recurrence) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    case 'weekdays': {
      do d.setUTCDate(d.getUTCDate() + 1);
      while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      return d;
    }
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case 'monthly': {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      return d;
    }
    default:
      return null;
  }
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-based week start. */
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
