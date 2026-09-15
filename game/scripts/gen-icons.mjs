// Génère des icônes PNG (ballon stylisé sur fond dégradé club) sans dépendance
// externe : encodeur PNG minimal (chunks IHDR/IDAT/IEND + CRC32 + zlib intégré).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * 0.34;
  // Club colors: dégradé bleu nuit -> vert émeraude (kit par défaut du club fictif)
  const top = [11, 31, 58];
  const bottom = [7, 74, 59];
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const bgR = lerp(top[0], bottom[0], t);
    const bgG = lerp(top[1], bottom[1], t);
    const bgB = lerp(top[2], bottom[2], t);
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let r = bgR, g = bgG, b = bgB, a = 255;
      if (dist <= ballR) {
        // Ballon blanc avec pentagones sombres simplifiés
        r = 245; g = 247; b = 250;
        const ang = Math.atan2(dy, dx);
        const ring = dist / ballR;
        const petal = Math.cos(ang * 5) > 0.55 && ring > 0.35 && ring < 0.85;
        const centerDot = dist < ballR * 0.22;
        if (petal || centerDot) {
          r = 20; g = 24; b = 28;
        }
        if (dist > ballR * 0.94) {
          // léger contour
          r = lerp(r, 20, 0.5); g = lerp(g, 24, 0.5); b = lerp(b, 28, 0.5);
        }
      } else if (dist <= ballR + size * 0.02) {
        // ombre douce autour du ballon
        const edge = 1 - (dist - ballR) / (size * 0.02);
        r = lerp(bgR, 0, edge * 0.25);
        g = lerp(bgG, 0, edge * 0.25);
        b = lerp(bgB, 0, edge * 0.25);
      }
      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(g);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = a;
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(new URL("../public/icons", import.meta.url), { recursive: true });
const sizes = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
];
for (const [name, size] of sizes) {
  const png = drawIcon(size);
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png);
  console.log(`écrit ${name} (${size}x${size}, ${png.length} octets)`);
}
