import { describe, expect, it } from '@jest/globals';
import {
  canManageHouse,
  canViewHouse,
  isBlocked,
  isCarsAdmin,
  isModerator,
  isParkingAdmin,
  isValidRole,
  listHouseRoles,
  normalizeRoles,
} from '../../../core/utils/roles.js';

describe('roles vocabulary', () => {
  it('normalizes a role list (trim, dedupe, non-strings)', () => {
    expect(normalizeRoles(['global:admin', ' global:admin ', 42, null])).toEqual(['global:admin']);
  });

  it('rejects unknown role strings but accepts house roles', () => {
    expect(isValidRole('house:39/1:manage')).toBe(true);
    expect(isValidRole('parking:admin')).toBe(true);
    expect(isValidRole('house:39:delete')).toBe(false);
    expect(isValidRole('superuser')).toBe(false);
  });

  it('lists house roles of a user', () => {
    expect(listHouseRoles({ roles: ['house:39:view', 'house:39/1:manage', 'cars:admin'] })).toEqual([
      { house: '39', action: 'view' },
      { house: '39/1', action: 'manage' },
    ]);
  });
});

describe('house access', () => {
  const resident = { roles: ['house:39:view'] };
  const manager = { roles: ['house:39:manage'] };

  it('grants view only for the exact building', () => {
    expect(canViewHouse(resident, '39')).toBe(true);
    expect(canViewHouse(resident, '39/1')).toBe(false);
    expect(canViewHouse(resident, '12')).toBe(false);
  });

  it('does not let a view role edit', () => {
    expect(canManageHouse(resident, '39')).toBe(false);
  });

  it('lets a manage role view', () => {
    expect(canViewHouse(manager, '39')).toBe(true);
    expect(canManageHouse(manager, '39')).toBe(true);
  });

  it('gives staff every building', () => {
    expect(canViewHouse({ roles: ['global:moderator'] }, '12')).toBe(true);
    expect(canManageHouse({ roles: ['global:moderator'] }, '12')).toBe(false);
    expect(canManageHouse({ roles: ['global:admin'] }, '12')).toBe(true);
  });

  it('denies an anonymous user', () => {
    expect(canViewHouse(null, '39')).toBe(false);
    expect(canViewHouse(undefined, '')).toBe(false);
  });
});

describe('service and global roles', () => {
  it('scopes parking and cars administration', () => {
    expect(isParkingAdmin({ roles: ['parking:admin'] })).toBe(true);
    expect(isParkingAdmin({ roles: ['cars:admin'] })).toBe(false);
    expect(isCarsAdmin({ roles: ['cars:admin'] })).toBe(true);
    expect(isCarsAdmin({ roles: ['global:admin'] })).toBe(true);
  });

  it('treats moderator as staff and blocked as blocked', () => {
    expect(isModerator({ roles: ['global:moderator'] })).toBe(true);
    expect(isModerator({ roles: ['global:activist'] })).toBe(false);
    expect(isBlocked({ roles: ['global:blocked'] })).toBe(true);
  });

  it('ignores the removed legacy status field', () => {
    expect(isModerator({ status: 'admin', roles: [] })).toBe(false);
  });
});
