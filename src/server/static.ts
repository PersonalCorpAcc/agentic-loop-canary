import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

/**
 * The built front end, served by the same process that serves the API.
 *
 * One origin, which is the point: the socket then needs no CORS, no second host and no
 * separate deployment, and `wss://` follows the page's own scheme without being told.
 */

const types: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * The file a request asks for, or `index.html` for anything that is not a file.
 *
 * Returns undefined when the path escapes the root: a request for `../../etc/passwd` is not a
 * missing file, it is an attempt, and resolving it before comparing is what makes the check
 * real rather than a string test somebody can encode their way around.
 */
export function resolveAsset(root: string, urlPath: string): string | undefined {
  const withoutQuery = (urlPath.split("?")[0] ?? "/");
  const decoded = safeDecode(withoutQuery);
  if (decoded === undefined) return undefined;

  const candidate = resolve(join(root, normalize(decoded)));
  const rootResolved = resolve(root);
  if (candidate !== rootResolved && !candidate.startsWith(rootResolved + sep)) return undefined;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  // Anything else is a client route: the single page answers for it.
  return join(rootResolved, "index.html");
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function serveAsset(root: string, urlPath: string, response: ServerResponse): void {
  const file = resolveAsset(root, urlPath);
  if (file === undefined || !existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    // The built assets carry a content hash in their name; index.html must not be cached or a
    // deploy is invisible until somebody clears their browser.
    "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(response);
}
