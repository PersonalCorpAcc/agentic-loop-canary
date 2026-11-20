import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { authHeaders, signAppJwt } from "./github-app.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

describe("signAppJwt", () => {
  it("signs a JWT whose claims and signature a verifier accepts", () => {
    const nowMs = 1_700_000_000_000;
    const token = signAppJwt("12345", pem, () => nowMs);
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString()) as { iss: string; iat: number; exp: number };
    expect(claims.iss).toBe("12345");
    expect(claims.exp - claims.iat).toBe(10 * 60 + 60);
    const verified = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, signature!, "base64url");
    expect(verified).toBe(true);
  });

  it("signs with a private key whose newlines arrive as literal \\n escapes", () => {
    const escaped = pem.replace(/\n/g, "\\n");
    const token = signAppJwt("12345", escaped, () => 1_700_000_000_000);
    const [header, payload, signature] = token.split(".");
    const verified = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, signature!, "base64url");
    expect(verified).toBe(true);
  });
});

describe("authHeaders", () => {
  it("falls back to a personal token when no App is configured", async () => {
    const fetchImpl = vi.fn();
    const headers = await authHeaders("acme", "widgets", { personalToken: "person-token", fetchImpl });
    expect(headers).toEqual({ authorization: "Bearer person-token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns no authorization header when neither an App nor a token is configured", async () => {
    const headers = await authHeaders("acme", "widgets", { personalToken: "", fetchImpl: vi.fn() });
    expect(headers).toEqual({});
  });

  it("exchanges a JWT for an installation token, caches it, and reuses it until shortly before it expires", async () => {
    let now = 1_700_000_000_000;
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/installation")) {
        return new Response(JSON.stringify({ id: 42 }), { status: 200 });
      }
      if (url.endsWith("/app/installations/42/access_tokens")) {
        return new Response(JSON.stringify({ token: "installation-token-1", expires_at: expiresAt }), { status: 201 });
      }
      throw new Error(`unexpected request: ${url}`);
    });
    const config = { appId: "999", appPrivateKey: pem, fetchImpl, now: () => now };

    const first = await authHeaders("acme", "widgets", config);
    expect(first).toEqual({ authorization: "Bearer installation-token-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // Still well within the cached token's lifetime: no new request.
    now += 30 * 60 * 1000;
    const second = await authHeaders("acme", "widgets", config);
    expect(second).toEqual({ authorization: "Bearer installation-token-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // Past the 60s-before-expiry margin: a fresh exchange happens.
    now = Date.parse(expiresAt) - 1_000;
    const refreshedExpiry = new Date(now + 60 * 60 * 1000).toISOString();
    fetchImpl.mockImplementationOnce(async (url: string) =>
      url.endsWith("/installation") ? new Response(JSON.stringify({ id: 42 }), { status: 200 }) : new Response("", { status: 500 }));
    fetchImpl.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ token: "installation-token-2", expires_at: refreshedExpiry }), { status: 201 }));
    const third = await authHeaders("acme", "widgets", config);
    expect(third).toEqual({ authorization: "Bearer installation-token-2" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
