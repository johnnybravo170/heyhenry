import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the admin supabase client module BEFORE importing the helper.
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

// Also mock createClient to satisfy helper imports that don't matter here.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

import { isPlatformAdmin } from '@/lib/auth/helpers';

describe('isPlatformAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for an empty user id', async () => {
    const result = await isPlatformAdmin('');
    expect(result).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns true when the user has a platform_admins row', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null });
    const result = await isPlatformAdmin('u1');
    expect(result).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('platform_admins');
    expect(selectMock).toHaveBeenCalledWith('user_id');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('returns false when no row exists', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await isPlatformAdmin('u2');
    expect(result).toBe(false);
  });
});
