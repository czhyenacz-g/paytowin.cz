/**
 * lib/users/moderation.test.ts — unit testy pro ban/unban logiku.
 *
 * Testuje čistou logiku — supabaseAdmin je mockován.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock supabaseAdmin ────────────────────────────────────────────────────────

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: () => ({
      upsert: mockUpsert,
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
    auth: {
      admin: {
        listUsers: vi.fn(),
        getUserById: vi.fn(),
      },
    },
  },
}));

import {
  getUserModerationStatus,
  isUserBanned,
  assertUserNotBanned,
} from "./moderation";

// ─── Testy ────────────────────────────────────────────────────────────────────

describe("getUserModerationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vrátí 'active' pokud záznam neexistuje", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const status = await getUserModerationStatus("user-1");
    expect(status).toBe("active");
  });

  it("vrátí 'banned' pokud je hráč zakázán", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "banned" }, error: null });
    const status = await getUserModerationStatus("user-1");
    expect(status).toBe("banned");
  });

  it("vrátí 'active' pokud je stav active", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    const status = await getUserModerationStatus("user-1");
    expect(status).toBe("active");
  });
});

describe("isUserBanned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("vrátí false pro aktivního hráče", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await isUserBanned("user-1")).toBe(false);
  });

  it("vrátí true pro zakázaného hráče", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "banned" }, error: null });
    expect(await isUserBanned("user-1")).toBe(true);
  });
});

describe("assertUserNotBanned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nehodí chybu pro aktivního hráče", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(assertUserNotBanned("user-1")).resolves.toBeUndefined();
  });

  it("hodí chybu pro zakázaného hráče", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "banned" }, error: null });
    await expect(assertUserNotBanned("user-1")).rejects.toThrow(
      "Přístup odepřen: tento hráč byl zakázán."
    );
  });
});
