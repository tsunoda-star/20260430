import { describe, it, expect } from 'vitest';
import {
  PERMISSION_MATRIX,
  canPerform,
  whyNotAllowedJa,
  type PermissionAction,
} from '../permissions';
import type { UserRole } from '@/lib/auth/session';

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

describe('PERMISSION_MATRIX (spec.md §6.2 SSOT)', () => {
  it('owner can perform every action', () => {
    for (const action of Object.keys(PERMISSION_MATRIX) as PermissionAction[]) {
      expect(canPerform('owner', action)).toBe(true);
    }
  });

  it('viewer can only read / export', () => {
    const allowed = (Object.keys(PERMISSION_MATRIX) as PermissionAction[]).filter((a) =>
      canPerform('viewer', a),
    );
    expect(allowed.sort()).toEqual(['assessment.read', 'export.run']);
  });

  it('reviewer is read-only + ai_chat + Good/Bad + note追記', () => {
    const allowed = (Object.keys(PERMISSION_MATRIX) as PermissionAction[]).filter((a) =>
      canPerform('reviewer', a),
    );
    expect(allowed.sort()).toEqual(
      [
        'ai_chat.ask',
        'ai_chat.rate',
        'assessment.read',
        'assessment_item.update_note',
        'export.run',
      ].sort(),
    );
  });

  it('editor can do business actions but no admin/master/audit', () => {
    expect(canPerform('editor', 'company.create')).toBe(true);
    expect(canPerform('editor', 'assessment.create')).toBe(true);
    expect(canPerform('editor', 'assessment_item.update_status')).toBe(true);
    expect(canPerform('editor', 'admin.invite_user')).toBe(false);
    expect(canPerform('editor', 'master.update')).toBe(false);
    expect(canPerform('editor', 'audit_log.read')).toBe(false);
    expect(canPerform('editor', 'company.update')).toBe(false); // admin only
    expect(canPerform('editor', 'assessment.delete')).toBe(false); // admin only
  });

  it('admin gets owner powers except billing/owner-transfer (no such action defined here)', () => {
    expect(canPerform('admin', 'company.update')).toBe(true);
    expect(canPerform('admin', 'admin.invite_user')).toBe(true);
    expect(canPerform('admin', 'master.update')).toBe(true);
    expect(canPerform('admin', 'audit_log.read')).toBe(true);
    expect(canPerform('admin', 'assessment.delete')).toBe(true);
  });

  it('every role can read assessments and run export', () => {
    for (const r of ALL_ROLES) {
      expect(canPerform(r, 'assessment.read')).toBe(true);
      expect(canPerform(r, 'export.run')).toBe(true);
    }
  });

  it('viewer cannot edit / chat / rate / invite', () => {
    const denied: PermissionAction[] = [
      'company.create',
      'company.update',
      'assessment.create',
      'assessment.delete',
      'assessment_item.update_status',
      'assessment_item.update_note',
      'assessment_item.assign',
      'ai_chat.ask',
      'ai_chat.rate',
      'admin.invite_user',
      'master.update',
      'audit_log.read',
    ];
    for (const a of denied) {
      expect(canPerform('viewer', a)).toBe(false);
    }
  });
});

describe('whyNotAllowedJa', () => {
  it('returns null when allowed', () => {
    expect(whyNotAllowedJa('owner', 'company.create')).toBeNull();
    expect(whyNotAllowedJa('viewer', 'export.run')).toBeNull();
  });

  it('returns Japanese explanation when denied', () => {
    const msg = whyNotAllowedJa('viewer', 'company.create');
    expect(msg).toContain('URL入力');
    expect(msg).toContain('viewer');
  });

  it('handles all-deny actions gracefully (none currently)', () => {
    // 念のため仕様変更時も落ちないことを確認
    expect(typeof whyNotAllowedJa('reviewer', 'admin.invite_user')).toBe('string');
  });
});
