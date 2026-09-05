import { afterEach, describe, expect, it } from "vitest";
import { getPool } from "./index";

const ORIGINAL = process.env.DATABASE_URL;

function withEnv(value: string | undefined, fn: () => void) {
  if (value === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = value;
  try {
    fn();
  } finally {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  }
}

describe("getPool DATABASE_URL guard", () => {
  afterEach(() => {
    // never leak a pool between tests
    const g = globalThis as typeof globalThis & { __homeinoPool?: unknown };
    delete g.__homeinoPool;
  });

  it("throws when DATABASE_URL is missing", () => {
    withEnv(undefined, () => {
      expect(() => getPool()).toThrow("DATABASE_URL is required");
    });
  });

  it("throws for non-Postgres schemes (sandbox file: URLs) — clean mock fallback", () => {
    withEnv("file:/home/z/db/custom.db", () => {
      expect(() => getPool()).toThrow("DATABASE_URL is required");
    });
  });

  it("accepts postgres:// and postgresql:// URLs without connecting", () => {
    withEnv("postgresql://u:p@aws-1-eu-west-1.pooler.supabase.com:5432/postgres", () => {
      const pool = getPool();
      expect(pool.totalCount).toBe(0);
    });
    withEnv("postgres://u:p@localhost:5432/db", () => {
      expect(getPool()).toBeDefined();
    });
  });
});
