import { afterEach, describe, expect, it, vi } from "vitest";
import { configurePlaidCompanion, plaidCompanion } from "./plaidCompanion";

describe("Plaid companion client", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("pairs before protected calls and keeps session token out of storage", async () => {
    const session = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => { session.set(key, value); },
      removeItem: (key: string) => { session.delete(key); },
    } });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(
      init?.body ? { sessionToken: "memory-session" } : { linkToken: "link", expiration: "later" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    configurePlaidCompanion("http://127.0.0.1:43127");
    await expect(plaidCompanion.createLinkToken(90)).rejects.toThrow("Pair Budgetzilla");
    await plaidCompanion.pair("one-time");
    await plaidCompanion.createLinkToken(90);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer memory-session" });
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
    expect(session.get("budgetzilla.plaidSessionToken")).toBe("memory-session");
  });

  it("rejects non-loopback companion addresses", () => {
    expect(() => configurePlaidCompanion("http://example.com:43127")).toThrow("loopback");
  });
});
