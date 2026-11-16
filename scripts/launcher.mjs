/**
 * Installs or removes the native launcher that lets the extension start the
 * server when you press play.
 *
 *   npm run launcher:install     build the app, register the launcher with Chrome
 *   npm run launcher:uninstall   unregister it
 *
 * Windows only for now: the launcher is registered under
 * HKCU\Software\Google\Chrome\NativeMessagingHosts (current user, no admin).
 * Run install again after changing the code, to rebuild the app.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIST_DIR } from "../launcher/host.mjs";

const HOST_NAME = "com.chrono_exe.launcher";
const REGISTRY_KEY = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcherDir = path.join(root, "launcher");
const wrapper = path.join(launcherDir, "chrono-launcher.cmd");
const hostManifest = path.join(launcherDir, `${HOST_NAME}.json`);

/** The extension ID Chrome derives from the public key in manifest.json. */
function extensionId() {
  const manifest = JSON.parse(readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
  const digest = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32);
  return Array.from(digest, (hex) => String.fromCharCode(97 + parseInt(hex, 16))).join("");
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`${path.basename(command)} ${args.join(" ")} failed`);
}

function install() {
  if (process.platform !== "win32") {
    console.error("The launcher is only available on Windows for now. Start the server with: npm run start");
    process.exit(1);
  }
  console.log("> Building the app (production, in .next-app)...");
  run(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build"], { CHRONO_DIST: DIST_DIR });

  writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "%~dp0host.mjs" %*\r\n`);
  const id = extensionId();
  writeFileSync(
    hostManifest,
    `${JSON.stringify(
      {
        name: HOST_NAME,
        description: "Starts the CHRONO.EXE server when you press play",
        path: wrapper,
        type: "stdio",
        allowed_origins: [`chrome-extension://${id}/`]
      },
      null,
      2
    )}\n`
  );
  run("reg", ["add", REGISTRY_KEY, "/ve", "/t", "REG_SZ", "/d", hostManifest, "/f"]);

  console.log(`\n> Launcher installed for extension ${id}.`);
  console.log("> Reload the extension in chrome://extensions, then press play in its popup.");
}

function uninstall() {
  if (process.platform === "win32") {
    spawnSync("reg", ["delete", REGISTRY_KEY, "/f"], { stdio: "ignore" });
  }
  for (const file of [wrapper, hostManifest]) if (existsSync(file)) rmSync(file);
  console.log("> Launcher removed. Start the server yourself with: npm run dev");
}

const command = process.argv[2];
if (command === "install") install();
else if (command === "uninstall") uninstall();
else {
  console.error("Usage: node scripts/launcher.mjs install|uninstall");
  process.exit(1);
}
