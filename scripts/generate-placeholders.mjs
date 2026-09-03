// Writes solid-tone placeholder PNGs into each dated public/images/ folder so
// the site has something to render before real photos are dropped in.
// Run with: npm run placeholders
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Vertical gradient between two RGB tones, plus a faint centre band so the
// placeholder reads as a placeholder rather than a rendering bug.
function png(width, height, top, bottom) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    const t = y / (height - 1);
    const band = Math.abs(t - 0.5) < 0.004 ? 12 : 0;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        raw[p++] = Math.max(0, Math.round(top[c] + (bottom[c] - top[c]) * t) - band);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const entries = [
  { folder: "2026-05-11", count: 5, top: [214, 219, 210], bottom: [166, 176, 164] },
  { folder: "2026-06-03", count: 6, top: [206, 172, 148], bottom: [140, 96, 78] },
  { folder: "2026-07-08", count: 5, top: [176, 182, 196], bottom: [96, 104, 122] },
];

// Landscape only, matching the real photos, but a spread of landscape ratios so
// the layout is exercised the way those photos will exercise it.
const ratios = [
  [1600, 1200], // 4:3
  [1600, 1067], // 3:2
  [1600, 900], // 16:9
  [1500, 1125], // 4:3
  [1600, 1000], // 8:5
  [1400, 1050], // 4:3
];

for (const entry of entries) {
  const dir = join(root, "public", "images", entry.folder);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < entry.count; i++) {
    const [w, h] = ratios[i % ratios.length];
    const shift = i * 10;
    const file = join(dir, `${String(i + 1).padStart(2, "0")}-placeholder.png`);
    writeFileSync(
      file,
      png(
        w,
        h,
        entry.top.map((v) => Math.min(255, v + shift)),
        entry.bottom.map((v) => Math.max(0, v - shift)),
      ),
    );
    console.log(`wrote ${file.replace(root + "/", "")} (${w}x${h})`);
  }
}
