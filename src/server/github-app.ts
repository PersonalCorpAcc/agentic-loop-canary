import { createSign } from "node:crypto";

/**
 * GitHub App authentication: sign a JWT as the App, exchange it for a per-repository-owner
 * installation token, and cache that token until shortly before it expires.
 *
 * `GH_TOKEN`/`GITHUB_TOKEN` (a person's token) is what the server used to poll with, and
 * spent that person's own 5,000-an-hour allowance doing it (#207). An App's installation
 * token draws from the App's own allowance instead, so `forge.ts` prefers this whenever
 * `GH_APP_ID` and `GH_APP_PRIVATE_KEY` are both set.
 */

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A clock-drift cushion both ends of the token's validity window get: issued a minute in
 *  the past, so a slightly slow local clock never mints a token the forge sees as not yet
 *  valid. */
const CLOCK_DRIFT_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 600;

/** An App-authenticated JWT (RS256), good for ten minutes -- the maximum the forge accepts
 *  -- signed with `node:crypto` directly so this adds no dependency. */
export function signAppJwt(appId: string, privateKeyPem: string, now: () => number = Date.now): string {
  const issuedAt = Math.floor(now() / 1000) - CLOCK_DRIFT_SECONDS;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: issuedAt, exp: issuedAt + JWT_LIFETIME_SECONDS, iss: appId };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

export interface AppCredentials {
  readonly appId: string;
  readonly privateKey: string;
}

/** `GH_APP_ID` and `GH_APP_PRIVATE_KEY` from the environment, or `undefined` when either is
 *  unset -- the signal `forge.ts` falls back to `GH_TOKEN` on. A PEM pasted into a platform's
 *  single-line env var config arrives with literal `\n` rather than real newlines, so those
 *  are unescaped here rather than asking every deployment to get the quoting right. */
export function appCredentialsOf(env: NodeJS.ProcessEnv = process.env): AppCredentials | undefined {
  const appId = env["GH_APP_ID"];
  const privateKey = env["GH_APP_PRIVATE_KEY"];
  if (appId === undefined || appId === "" || privateKey === undefined || privateKey === "") return undefined;
  return { appId, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function authHeaders(jwt: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    authorization: `Bearer ${jwt}`,
  };
}

async function fetchInstallationId(
  owner: string,
  name: string,
  jwt: string,
  fetchImpl: typeof fetch,
): Promise<number> {
  const response = await fetchImpl(`https://api.github.com/repos/${owner}/${name}/installation`, {
    headers: authHeaders(jwt),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} for ${owner}/${name}'s installation`);
  const body = await response.json() as { id: number };
  return body.id;
}

interface InstallationToken {
  readonly token: string;
  readonly expiresAt: number;
}

async function exchangeInstallationToken(
  installationId: number,
  jwt: string,
  fetchImpl: typeof fetch,
): Promise<InstallationToken> {
  const response = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: authHeaders(jwt),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} exchanging an installation token`);
  const body = await response.json() as { token: string; expires_at: string };
  return { token: body.token, expiresAt: Date.parse(body.expires_at) };
}

/** Refresh this long before `expires_at`: large enough that a token handed out to one
 *  in-flight request is never seen as expired mid-use, small enough that a cached token is
 *  still reused for nearly its whole hour-long life. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const installationTokens = new Map<string, InstallationToken>();

/** An installation access token for `repo`'s owner, cached until shortly before it expires.
 *  Every repository under the same owner shares one cache entry and one token, the same way
 *  one installation covers every repository the App was installed on for that owner. */
export async function installationTokenFor(
  repo: string,
  credentials: AppCredentials,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<string> {
  const [owner, name] = repo.split("/");
  if (owner === undefined || name === undefined) throw new Error(`not an "owner/name" repo: ${repo}`);

  const cached = installationTokens.get(owner);
  if (cached !== undefined && cached.expiresAt - REFRESH_SKEW_MS > now()) return cached.token;

  const jwt = signAppJwt(credentials.appId, credentials.privateKey, now);
  const installationId = await fetchInstallationId(owner, name, jwt, fetchImpl);
  const token = await exchangeInstallationToken(installationId, jwt, fetchImpl);
  installationTokens.set(owner, token);
  return token.token;
}

/** Test-only: the module-level cache otherwise outlives any one test. */
export function clearInstallationTokenCache(): void {
  installationTokens.clear();
}
