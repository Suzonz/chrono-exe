/**
 * CHRONO.EXE native launcher (Chrome Native Messaging host).
 *
 * Chrome extensions cannot start programs. When you press play and no server
 * answers, the extension asks Chrome to run this script, which starts the
 * production server in the background (no window) and replies at once. The
 * server stops itself when you press stop (CHRONO_LAUNCHER=1).
 *
 * Protocol: one message in, one message out, each a 4-byte little-endian
 * length followed by UTF-8 JSON. Nothing else may be written to stdout.
 *
 * Installed by `npm run launcher:install` (see scripts/launcher.mjs).
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, statSync, truncateSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PORT = 3005;
export const DIST_DIR = ".next-app";
export const SERVER_URL = `http://127.0.0.1:${PORT}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const LOG_FILE = path.join(here, "server.log");
const MAX_LOG_BYTES = 1024 * 1024;

/** Reads one length-prefixed message from a stream of chunks. */
export function decodeMessage(buffer) {
  if (buffer.length < 4) return null;
  const length = buffer.readUInt32LE(0);
  if (buffer.length < 4 + length) return null;
  return JSON.parse(buffer.subarray(4, 4 + length).toString("utf8"));
}

export function encodeMessage(value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

async function isRunning() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).app === "CHRONO.EXE";
  } catch {
    return false;
  }
}

function startServer() {
  if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_LOG_BYTES) truncateSync(LOG_FILE, 0);
  const log = openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", CHRONO_LAUNCHER: "1", CHRONO_DIST: DIST_DIR },
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log]
  });
  child.unref();
  closeSync(log);
}

export async function handle(message) {
  if (message?.action === "ping") return { ok: true, url: SERVER_URL };
  if (message?.action !== "start") return { ok: false, error: "UNKNOWN_ACTION" };
  if (await isRunning()) return { ok: true, url: SERVER_URL, alreadyRunning: true };
  if (!existsSync(path.join(root, DIST_DIR, "BUILD_ID"))) return { ok: false, error: "NOT_BUILT" };
  startServer();
  return { ok: true, url: SERVER_URL, alreadyRunning: false };
}

function main() {
  let buffer = Buffer.alloc(0);
  let done = false;
  const reply = (value) => process.stdout.write(encodeMessage(value), () => process.exit(0));
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (done) return;
    let message;
    try {
      message = decodeMessage(buffer);
    } catch {
      done = true;
      reply({ ok: false, error: "BAD_MESSAGE" });
      return;
    }
    if (message === null) return;
    done = true;
    handle(message).then(reply, (error) => reply({ ok: false, error: String(error?.message ?? error) }));
  });
  process.stdin.on("end", () => {
    if (!done) process.exit(0);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
