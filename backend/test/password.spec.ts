import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../src/modules/auth/password";

describe("password hashing", () => {
  it("hashes with scrypt and verifies the correct password", async () => {
    const stored = await hashPassword("Password123!");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("Password123!", stored)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("Password123!");
    expect(await verifyPassword("password123!", stored)).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");
    expect(first).not.toBe(second);
    expect(await verifyPassword("same-password", first)).toBe(true);
    expect(await verifyPassword("same-password", second)).toBe(true);
  });

  it("returns false for malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("never matches the dummy hash", async () => {
    expect(await verifyPassword("Password123!", DUMMY_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword("", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
