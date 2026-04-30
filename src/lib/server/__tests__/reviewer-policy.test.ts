import { describe, it, expect } from 'vitest';
import {
  checkReviewerCanEdit,
  reviewerForbiddenMessage,
  type ItemStatus,
} from '../reviewer-policy';
import type { UserRole } from '@/lib/auth/session';

const NON_REVIEWER_ROLES: UserRole[] = ['owner', 'admin', 'editor', 'viewer'];
const ALL_STATUSES: ItemStatus[] = ['open', 'in_progress', 'done', 'not_applicable'];

describe('checkReviewerCanEdit', () => {
  it('allows reviewer only when status === done', () => {
    expect(checkReviewerCanEdit('reviewer', 'done')).toEqual({ ok: true });
  });

  it('denies reviewer for non-done statuses', () => {
    for (const s of ['open', 'in_progress', 'not_applicable'] as ItemStatus[]) {
      const r = checkReviewerCanEdit('reviewer', s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('reviewer-status-not-done');
    }
  });

  it('does not constrain non-reviewer roles regardless of status', () => {
    for (const role of NON_REVIEWER_ROLES) {
      for (const s of ALL_STATUSES) {
        expect(checkReviewerCanEdit(role, s)).toEqual({ ok: true });
      }
    }
  });
});

describe('reviewerForbiddenMessage', () => {
  it('describes the current status for the 403 detail', () => {
    expect(reviewerForbiddenMessage('open')).toContain('status=done');
    expect(reviewerForbiddenMessage('open')).toContain('open');
  });
});
