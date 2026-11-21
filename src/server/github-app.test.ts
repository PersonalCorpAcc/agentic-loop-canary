import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appCredentialsOf, clearInstallationTokenCache, installationTokenFor, signAppJwt } from "./github-app.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function decode(segment: string): unknown {
  return JSON.parse(Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
}

describe("signing a GitHub App JWT", () => {
  it("is a RS256 token the App's public key verifies, naming the App and a short lifetime", () => {
    const now = () => Date.parse("2026-01-01T00:10:00Z");
    const jwt = signAppJwt("12345", privateKey, now);
    const [headerPart, payloadPart, signaturePart] = jwt.split(".");

    expect(decode(headerPart!)).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = decode(payloadPart!) as { iat: number; exp: number; iss: string };
    expect(payload.iss).toBe("12345");
    // Issued a minute in the past, to tolerate clock drift with the forge (GitHub's own
    // recommendation), and good for ten minutes -- never the hour a personal token gets.
    expect(payload.iat).toBe(Math.floor(now() / 1000) - 60);
    expect(payload.exp - payload.iat).toBe(600);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerPart}.${payloadPart}`);
    const signature = Buffer.from(signaturePart!.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(verifier.verify(publicKey, signature)).toBe(true);
  });
});

describe("reading App credentials out of the environment", () => {
  it("is undefined when either variable is missing", () => {
    expect(appCredentialsOf({})).toBeUndefined();
    expect(appCredentialsOf({ GH_APP_ID: "1" })).toBeUndefined();
    expect(appCredentialsOf({ GH_APP_PRIVATE_KEY: "key" })).toBeUndefined();
  });

  it("unescapes a literal \\n in a private key set as a single-line secret", () => {
    const credentials = appCredentialsOf({ GH_APP_ID: "1", GH_APP_PRIVATE_KEY: "line one\\nline two" });
    expect(credentials?.privateKey).toBe("line one\nline two");
  });
});

describe("exchanging a JWT for an installation token", () => {
  afterEach(() => {
    clearInstallationTokenCache();
  });

  function fakeForge(token: string, expiresAt: string) {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/installation")) {
        return new Response(JSON.stringify({ id: 999 }), { status: 200 });
      }
      return new Response(JSON.stringify({ token, expires_at: expiresAt }), { status: 200 });
    });
    return fetchImpl as unknown as typeof fetch;
  }

  it("fetches the installation id, then the token", async () => {
    const fetchImpl = fakeForge("tok-1", "2026-01-01T01:00:00Z");
    const now = () => Date.parse("2026-01-01T00:00:00Z");

    const token = await installationTokenFor("owner/repo", { appId: "1", privateKey }, fetchImpl, now);

    expect(token).toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/installation", expect.anything());
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/999/access_tokens",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reuses a cached token for the same owner until shortly before it expires", async () => {
    const fetchImpl = fakeForge("tok-1", "2026-01-01T01:00:00Z");
    let now = Date.parse("2026-01-01T00:00:00Z");

    const first = await installationTokenFor("owner/repo", { appId: "1", privateKey }, fetchImpl, () => now);
    expect(first).toBe("tok-1");

    // Still comfortably inside the expiry window: no second exchange.
    now = Date.parse("2026-01-01T00:30:00Z");
    const second = await installationTokenFor("owner/other-repo", { appId: "1", privateKey }, fetchImpl, () => now);
    expect(second).toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refetches once within five minutes of expiry", async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify({ id: 999 }), { status: 200 }))
      .mockImplementationOnce(async () => new Response(JSON.stringify({ token: "tok-1", expires_at: "2026-01-01T01:00:00Z" }), { status: 200 }))
      .mockImplementationOnce(async () => new Response(JSON.stringify({ id: 999 }), { status: 200 }))
      .mockImplementationOnce(async () => new Response(JSON.stringify({ token: "tok-2", expires_at: "2026-01-01T02:00:00Z" }), { status: 200 }));
    let now = Date.parse("2026-01-01T00:00:00Z");

    const first = await installationTokenFor("owner/repo", { appId: "1", privateKey }, fetchImpl as unknown as typeof fetch, () => now);
    expect(first).toBe("tok-1");

    // Within the five-minute refresh skew of the cached token's expiry: treated as expired.
    now = Date.parse("2026-01-01T00:56:00Z");
    const second = await installationTokenFor("owner/repo", { appId: "1", privateKey }, fetchImpl as unknown as typeof fetch, () => now);
    expect(second).toBe("tok-2");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
