import { describe, expect, it } from 'vitest';
import {
  ALL_SETTINGS_ITEMS,
  getSettingsNav,
  getSettingsNavCounts,
  type SettingsRole,
} from '@/components/features/settings/settings-nav-items';

/**
 * The role × destination matrix is the headline of the settings redesign.
 * These tests pin it so an Ops tweak to ROLE_HIDDEN_HREFS surfaces here as
 * a deliberate diff, not a silent regression. Counts are asserted against
 * the foot copy in the OD render (owner ≈ 26 of 28, member ≈ 21 of 28).
 */

const RENO = 'renovation'; // GC vertical — hides Pricebook
const PW = 'pressure_washing'; // non-GC — Pricebook stays

function visibleHrefs(role: SettingsRole, vertical: string | null): Set<string> {
  return new Set(
    getSettingsNav({ role, vertical })
      .flatMap((g) => g.items)
      .map((i) => i.href),
  );
}

const OWNER_ONLY_DESTINATIONS = [
  '/settings/security',
  '/settings/team',
  '/settings/billing',
  '/settings/account/delete',
  '/settings/data-export',
];

describe('settings nav role filter', () => {
  it('has 28 total destinations across all groups', () => {
    expect(ALL_SETTINGS_ITEMS).toHaveLength(28);
  });

  describe('owner', () => {
    it('sees everything except the vertical-hidden Pricebook on a GC vertical', () => {
      const visible = visibleHrefs('owner', RENO);
      // Owner hides nothing for role; only Pricebook drops (GC vertical).
      expect(visible.has('/settings/pricebook')).toBe(false);
      for (const href of OWNER_ONLY_DESTINATIONS) {
        expect(visible.has(href)).toBe(true);
      }
    });

    it('sees Pricebook on a non-GC vertical (full 28)', () => {
      const visible = visibleHrefs('owner', PW);
      expect(visible.has('/settings/pricebook')).toBe(true);
      expect(visible.size).toBe(28); // all 28 items visible
    });
  });

  describe('member', () => {
    it('hides the five owner-only destinations', () => {
      const visible = visibleHrefs('member', RENO);
      for (const href of OWNER_ONLY_DESTINATIONS) {
        expect(visible.has(href)).toBe(false);
      }
    });

    it('keeps the Audit log (render assumption wins over the brief)', () => {
      const visible = visibleHrefs('member', RENO);
      expect(visible.has('/settings/audit')).toBe(true);
    });

    it('keeps QuickBooks and the rest of the operational destinations', () => {
      const visible = visibleHrefs('member', RENO);
      expect(visible.has('/settings/quickbooks')).toBe(true);
      expect(visible.has('/settings/invoicing')).toBe(true);
      expect(visible.has('/settings/automations')).toBe(true);
      expect(visible.has('/settings/your-profile')).toBe(true);
    });
  });

  describe('admin (default — flagged for Ops to confirm)', () => {
    it('keeps Security and Team & workers (admins manage the team)', () => {
      const visible = visibleHrefs('admin', RENO);
      expect(visible.has('/settings/security')).toBe(true);
      expect(visible.has('/settings/team')).toBe(true);
    });

    it('hides only the owner-exclusive money/account-destruction group', () => {
      const visible = visibleHrefs('admin', RENO);
      expect(visible.has('/settings/billing')).toBe(false);
      expect(visible.has('/settings/data-export')).toBe(false);
      expect(visible.has('/settings/account/delete')).toBe(false);
    });
  });
});

describe('settings nav foot counts', () => {
  it('owner on a GC vertical: 27 of 28 shown, 1 hidden for vertical, 4 graduate', () => {
    const c = getSettingsNavCounts({ role: 'owner', vertical: RENO });
    expect(c).toEqual({
      total: 28,
      shown: 27,
      hiddenForRole: 0,
      hiddenForVertical: 1,
      graduate: 4,
    });
  });

  it('member on a GC vertical: 22 of 28 shown, 5 hidden for role, 1 hidden for vertical, 2 graduate', () => {
    const c = getSettingsNavCounts({ role: 'member', vertical: RENO });
    expect(c).toEqual({
      total: 28,
      shown: 22,
      hiddenForRole: 5,
      hiddenForVertical: 1,
      graduate: 2,
    });
  });

  it('admin on a GC vertical: 24 of 28 shown, 3 hidden for role, 1 hidden for vertical, 3 graduate', () => {
    const c = getSettingsNavCounts({ role: 'admin', vertical: RENO });
    expect(c).toEqual({
      total: 28,
      shown: 24,
      hiddenForRole: 3,
      hiddenForVertical: 1,
      graduate: 3,
    });
  });

  it('shown + hiddenForRole + hiddenForVertical always equals total', () => {
    for (const role of ['owner', 'admin', 'member'] as const) {
      for (const vertical of [RENO, PW, null]) {
        const c = getSettingsNavCounts({ role, vertical });
        expect(c.shown + c.hiddenForRole + c.hiddenForVertical).toBe(c.total);
      }
    }
  });
});
