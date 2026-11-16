/**
 * Generates the extension's pixel-art clock icons (16/32/48/128 px PNG)
 * without any image dependency. Run: `node scripts/generate-icons.mjs`
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "extension", "icons");

const COLORS = {
  ".": [0, 0, 0, 0],
  V: [124, 58, 237, 255],
  D: [21, 18, 27, 255],
  C: [21, 255, 209, 255],
  W: [232, 223, 238, 255]
};

/** 16×16 base sprite: violet tile, dark dial, cyan ring and hands. */
function sprite() {
  const rows = [];
  for (let y = 0; y < 16; y += 1) {
    let row = "";
    for (let x = 0; x < 16; x += 1) {
      const corner = (x < 2 && y < 1) || (x < 1 && y < 2) || (x > 13 && y < 1) || (x > 14 && y < 2) ||
        (x < 2 && y > 14) || (x < 1 && y > 13) || (x > 13 && y > 14) || (x > 14 && y > 13);
      const d = Math.hypot(x - 7.5, y - 7.5);
      let c = corner ? "." : "V";
      if (!corner && d < 6.3) c = d >= 5.2 ? "C" : "D";
      if (x === 7 && y >= 3 && y <= 7) c = "W";
      if (y === 7 && x >= 7 && x <= 10) c = "C";
      if ((x === 7 || x === 8) && (y === 7 || y === 8) && d < 1.2) c = "W";
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rows) {
  const scale = size / 16;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = COLORS[rows[Math.floor(y / scale)][Math.floor(x / scale)]];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

mkdirSync(outDir, { recursive: true });
const rows = sprite();
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), png(size, rows));
}
// Same sprite as the web app favicon.
writeFileSync(join(root, "src", "app", "icon.png"), png(64, rows));
console.log(rows.join("\n"));
console.log(`icons written to ${outDir}`);
