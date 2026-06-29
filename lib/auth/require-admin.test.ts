import { describe, expect, it } from "vitest";
import { requireAdminWithResolvers } from "./require-admin";

describe("requireAdminWithResolvers", () => {
  it("rejects missing session", async () => {
    await expect(
      requireAdminWithResolvers(async () => null, async () => true),
    ).rejects.toThrow("Přihlášení je vyžadováno.");
  });

  it("rejects non-admin user", async () => {
    await expect(
      requireAdminWithResolvers(
        async () => ({ userId: "user-1", email: "user@example.com" }),
        async () => false,
      ),
    ).rejects.toThrow("Přístup zamítnut.");
  });

  it("allows admin user", async () => {
    await expect(
      requireAdminWithResolvers(
        async () => ({ userId: "admin-1", email: "admin@example.com" }),
        async () => true,
      ),
    ).resolves.toEqual({ userId: "admin-1", email: "admin@example.com" });
  });
});

