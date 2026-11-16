/**
 * @file src/lib/glob.ts
 * @description Glob matching for categorization rules and the ignore list.
 *
 * Pattern syntax:
 *   `*`  any sequence of characters (including dots and slashes)
 *   `?`  exactly one character
 *   A leading `*.` also matches the bare domain: `*.github.com` matches
 *   `github.com` and `api.github.com`.
 *
 * Patterns are tested against several views of a URL so users can write
 * the natural form: `github.com`, `localhost:*`, `*notion.so*`,
 * `github.com/my-org/*` or a full `https://...` URL all work.
 * Matching is case-insensitive. This module is pure (client + server safe).
 */

function escapeRegExp(input: string): string {
  return input.replace(/[|\\{}()[\]^$+.]/g, "\\$&");
}

function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase();
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePattern(pattern);
  let prefix = "";
  let body = normalized;

  if (body.startsWith("*.")) {
    prefix = "(?:.*\\.)?";
    body = body.slice(2);
  }

  const source = escapeRegExp(body).replaceAll("*", ".*").replaceAll("?", ".");
  return new RegExp(`^${prefix}${source}$`, "i");
}

/** Raw glob test against a single string. */
export function matchesGlob(value: string, pattern: string): boolean {
  return globToRegExp(pattern).test(value.trim().toLowerCase());
}

/** Returns the views of a URL a pattern may target. */
export function urlCandidates(rawUrl: string): string[] {
  const url = rawUrl.trim();
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const host = parsed.host.toLowerCase();
    const path = `${parsed.pathname}${parsed.search}`;
    const withoutProtocol = `${host}${path}`;
    const candidates = new Set<string>([host, hostname, withoutProtocol, url.toLowerCase()]);
    if (path === "/") {
      candidates.add(`${host}/`);
    }
    return Array.from(candidates);
  } catch {
    return [url.toLowerCase()];
  }
}

/** True when the pattern matches any view of the URL. */
export function matchesUrl(url: string, pattern: string): boolean {
  if (normalizePattern(pattern).length === 0) {
    return false;
  }
  const matcher = globToRegExp(pattern);
  return urlCandidates(url).some((candidate) => matcher.test(candidate));
}

/** Host (with port) of a URL, or null when it cannot be parsed. */
export function hostOf(url: string): string | null {
  try {
    const host = new URL(url).host.toLowerCase();
    return host.length > 0 ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Address kept in the database: scheme, host and path only. Query strings and
 * fragments often carry tokens, emails or search terms, so they are dropped.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.slice(0, 512);
  } catch {
    return url.split(/[?#]/)[0].slice(0, 512);
  }
}

/** Pseudo-hosts sent by the extension for what is not a regular website. */
export const SPECIAL_HOSTS: Record<string, string> = {
  "outside.chrome": "Outside Chrome",
  "chrome.pages": "Chrome pages",
  "chrono.dashboard": "CHRONO.EXE dashboard"
};

/** Human-readable name of a host for display. */
export function siteLabel(host: string): string {
  return SPECIAL_HOSTS[host] ?? host;
}
