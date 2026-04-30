import { describe, it, expect } from 'vitest';
import { aggregateDashboard, type DashboardItemRow } from '../dashboard';

const FIXED_NOW = new Date('2026-04-30T00:00:00.000Z');

describe('aggregateDashboard', () => {
  it('returns zero-state for empty input', () => {
    const r = aggregateDashboard([]);
    expect(r.totalCount).toBe(0);
    expect(r.completionRate).toBe(0);
    expect(r.overdueCount).toBe(0);
    expect(r.statusCounts).toEqual({
      open: 0,
      in_progress: 0,
      done: 0,
      not_applicable: 0,
    });
    expect(r.categories).toEqual([]);
  });

  it('counts statuses and computes completion rate', () => {
    const rows: DashboardItemRow[] = [
      { status: 'open', dueDate: null, category: 'governance' },
      { status: 'in_progress', dueDate: null, category: 'governance' },
      { status: 'done', dueDate: null, category: 'governance' },
      { status: 'done', dueDate: null, category: 'data' },
    ];
    const r = aggregateDashboard(rows);
    expect(r.totalCount).toBe(4);
    expect(r.statusCounts).toEqual({
      open: 1,
      in_progress: 1,
      done: 2,
      not_applicable: 0,
    });
    expect(r.completionRate).toBe(0.5);
  });

  it('counts overdue (dueDate < today AND status != done)', () => {
    const rows: DashboardItemRow[] = [
      { status: 'open', dueDate: '2026-04-29', category: 'a' }, // overdue
      { status: 'in_progress', dueDate: '2026-04-30', category: 'a' }, // today, not overdue
      { status: 'done', dueDate: '2026-04-01', category: 'a' }, // done → not overdue
      { status: 'open', dueDate: '2026-05-15', category: 'a' }, // future
      { status: 'open', dueDate: null, category: 'a' }, // null
    ];
    const r = aggregateDashboard(rows, { now: FIXED_NOW });
    expect(r.overdueCount).toBe(1);
  });

  it('groups by category and sorts by total desc then name asc', () => {
    const rows: DashboardItemRow[] = [
      { status: 'open', dueDate: null, category: 'beta' },
      { status: 'open', dueDate: null, category: 'alpha' },
      { status: 'done', dueDate: null, category: 'alpha' },
      { status: 'done', dueDate: null, category: 'gamma' },
    ];
    const r = aggregateDashboard(rows);
    expect(r.categories.map((c) => c.category)).toEqual(['alpha', 'beta', 'gamma']);
    const alpha = r.categories[0]!;
    expect(alpha.total).toBe(2);
    expect(alpha.done).toBe(1);
    expect(alpha.byStatus).toEqual({
      open: 1,
      in_progress: 0,
      done: 1,
      not_applicable: 0,
    });
  });

  it('handles all not_applicable as 0% completion', () => {
    const rows: DashboardItemRow[] = [
      { status: 'not_applicable', dueDate: null, category: 'x' },
      { status: 'not_applicable', dueDate: null, category: 'x' },
    ];
    const r = aggregateDashboard(rows);
    expect(r.completionRate).toBe(0);
  });

  it('treats today (UTC) as not overdue', () => {
    const rows: DashboardItemRow[] = [
      { status: 'open', dueDate: '2026-04-30', category: 'x' },
    ];
    const r = aggregateDashboard(rows, { now: FIXED_NOW });
    expect(r.overdueCount).toBe(0);
  });
});
