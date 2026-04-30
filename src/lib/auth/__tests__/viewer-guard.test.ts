import { describe, it, expect } from 'vitest';
import {
  isViewerAllowedPath,
  shouldRedirectViewer,
  VIEWER_HOME_PATH,
} from '../viewer-guard';

describe('isViewerAllowedPath', () => {
  it('allows landing / auth / api / viewer home', () => {
    expect(isViewerAllowedPath('/')).toBe(true);
    expect(isViewerAllowedPath('/auth/login')).toBe(true);
    expect(isViewerAllowedPath('/auth/callback')).toBe(true);
    expect(isViewerAllowedPath('/api/v1/me')).toBe(true);
    expect(isViewerAllowedPath('/app/viewer')).toBe(true);
    expect(isViewerAllowedPath('/app/viewer/exports')).toBe(true);
  });

  it('blocks editor screens (S2 / S4-edit / S7 / S8)', () => {
    expect(isViewerAllowedPath('/app/companies/123')).toBe(false);
    expect(isViewerAllowedPath('/app/items/edit/42')).toBe(false);
    expect(isViewerAllowedPath('/app/admin/users')).toBe(false);
    expect(isViewerAllowedPath('/app/admin/master')).toBe(false);
  });

  it('blocks unknown app paths (whitelist behavior)', () => {
    expect(isViewerAllowedPath('/app/somewhere-else')).toBe(false);
    expect(isViewerAllowedPath('/dashboard')).toBe(false);
  });

  it('does not allow forbidden subroutes even when prefix would otherwise match viewer', () => {
    // /app/viewer is allowed, but if a forbidden prefix appears under it, deny
    // (現実装では forbidden の方を厳格にチェックするため、明示の deny が優先)
    expect(isViewerAllowedPath('/app/admin/users/invite')).toBe(false);
  });
});

describe('shouldRedirectViewer', () => {
  it('returns false for non-viewer roles regardless of path', () => {
    for (const role of ['owner', 'admin', 'editor', 'reviewer'] as const) {
      expect(shouldRedirectViewer(role, '/app/admin/users')).toBe(false);
    }
  });

  it('returns false for null role (unauthenticated)', () => {
    expect(shouldRedirectViewer(null, '/app/admin/users')).toBe(false);
  });

  it('returns true when viewer hits a forbidden path', () => {
    expect(shouldRedirectViewer('viewer', '/app/admin/users')).toBe(true);
    expect(shouldRedirectViewer('viewer', '/app/companies/9')).toBe(true);
  });

  it('returns false when viewer is on an allowed path', () => {
    expect(shouldRedirectViewer('viewer', '/app/viewer')).toBe(false);
    expect(shouldRedirectViewer('viewer', '/')).toBe(false);
    expect(shouldRedirectViewer('viewer', '/auth/login')).toBe(false);
  });
});

describe('VIEWER_HOME_PATH', () => {
  it('points to /app/viewer (Viewer 専用ホーム)', () => {
    expect(VIEWER_HOME_PATH).toBe('/app/viewer');
  });
});
