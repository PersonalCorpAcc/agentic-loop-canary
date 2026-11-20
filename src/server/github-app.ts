import { createSign } from "node:crypto";

/**
 * Which forge identity the server authenticates as: a GitHub App installation token when
 * `GH_APP_ID` and `GH_APP_PRIVATE_KEY` are both set, falling back to `GH_TOKEN` (a person's
 * token, or `GITHUB_TOKEN`) otherwise -- logged once, not on every poll, so the identity in
 * use is visible without being noise. An App's installation token carries its own 5,000-an-
 * hour allowance per installation, separate from any person's, which is the whole point: the
 * person's own tooling should never again be the thing that pays for this server's polling.
 */

let loggedIdentity = false;

function logIdentityOnce(identity: string): void {
  if (loggedIdentity) return;
  loggedIdentity = true;
  console.log(`forge identity: ${identity}`);
}

/** `GH_APP_PRIVATE_KEY` arrives from most hosts' env editors with its newlines escaped as a
 *  literal `\n`; a real PEM has no literal backslash in it, so this is safe to always run. */
export function normalisePrivateKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** A GitHub App JWT, RS256-signed by hand with `node:crypto` rather than a new dependency --
 *  the same three-part `header.payload.signature` shape any JWT library would produce. Ten
 *  minutes is the forge's own maximum lifetime; `iat` is set a minute in the past to tolerate
 *  clock drift between this host and the forge's, the same margin GitHub's own docs
 *  recommend. */
export function signAppJwt(id: string, privateKey: string, now: () => number = Date.now): string {
  const nowSeconds = Math.floor(now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 10 * 60, iss: id }));
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(normalisePrivateKey(privateKey), "base64url");
  return `${header}.${payload}.${signature}`;
}

interface InstallationToken {
  readonly token: string;
  readonly expiresAt: number;
}

const installationTokens = new Map<string, InstallationToken>();

/** The shape of the global `fetch` this module needs -- injected in tests the same way
 *  `MetricsCache` injects a `SnapshotFetcher` rather than reaching for a global mock. */
export type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<Response>;

function appHeaders(jwt: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    authorization: `Bearer ${jwt}`,
  };
}

/** The installation id for `owner/repo` -- the same request whether the App is installed on
 *  a user or an organisation, so there is nothing to resolve separately. */
async function installationIdOf(owner: string, repo: string, jwt: string, fetchImpl: Fetcher): Promise<number> {
  const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/installation`, { headers: appHeaders(jwt) });
  if (!response.ok) {
    throw new Error(`the forge answered ${response.status} resolving the App installation for ${owner}/${repo}`);
  }
  const body = await response.json() as { id: number };
  return body.id;
}

async function exchangeInstallationToken(installationId: number, jwt: string, fetchImpl: Fetcher): Promise<InstallationToken> {
  const response = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: appHeaders(jwt),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} exchanging an installation token`);
  const body = await response.json() as { token: string; expires_at: string };
  return { token: body.token, expiresAt: Date.parse(body.expires_at) };
}

/** A fresh installation token for `owner/repo`, cached until 60 seconds before it expires --
 *  the same margin as the JWT's own clock-drift allowance -- so a poll tick only ever pays
 *  for a token exchange when the cached one is genuinely about to lapse. */
async function installationTokenFor(
  owner: string,
  repo: string,
  id: string,
  privateKey: string,
  now: () => number,
  fetchImpl: Fetcher,
): Promise<string> {
  const cached = installationTokens.get(owner);
  if (cached !== undefined && cached.expiresAt - 60_000 > now()) return cached.token;

  const jwt = signAppJwt(id, privateKey, now);
  const installationId = await installationIdOf(owner, repo, jwt, fetchImpl);
  const token = await exchangeInstallationToken(installationId, jwt, fetchImpl);
  installationTokens.set(owner, token);
  return token.token;
}

/** Every value {@link authHeaders} would otherwise read off `process.env` or the global
 *  clock/`fetch`, all optional so a real caller supplies none of them and a test supplies
 *  only the ones it needs to fake. */
export interface AuthConfig {
  readonly now?: () => number;
  readonly fetchImpl?: Fetcher;
  readonly appId?: string;
  readonly appPrivateKey?: string;
  readonly personalToken?: string;
}

/** The `authorization` header to send to the forge for `owner/repo`: a cached GitHub App
 *  installation token when `GH_APP_ID` and `GH_APP_PRIVATE_KEY` are both set, `GH_TOKEN` (or
 *  `GITHUB_TOKEN`) otherwise, or no header at all against a public repository with neither
 *  configured. */
export async function authHeaders(owner: string, repo: string, config: AuthConfig = {}): Promise<Record<string, string>> {
  const now = config.now ?? Date.now;
  const fetchImpl = config.fetchImpl ?? fetch;
  const appId = config.appId ?? process.env["GH_APP_ID"];
  const privateKey = config.appPrivateKey ?? process.env["GH_APP_PRIVATE_KEY"];
  if (appId !== undefined && appId !== "" && privateKey !== undefined && privateKey !== "") {
    logIdentityOnce("GitHub App");
    const token = await installationTokenFor(owner, repo, appId, privateKey, now, fetchImpl);
    return { authorization: `Bearer ${token}` };
  }
  const personalToken = config.personalToken ?? process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
  if (personalToken !== "") {
    logIdentityOnce("personal access token");
    return { authorization: `Bearer ${personalToken}` };
  }
  logIdentityOnce("unauthenticated");
  return {};
}
