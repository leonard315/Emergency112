// Generates icon-192.png and icon-512.png — zero dependencies
// Uses Node.js built-in zlib to write valid PNG files

import zlib from 'zlib';
import fs from 'fs';

function writePNG(size, filePath) {
  const pixels = Buffer.alloc(size * size * 4); // RGBA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const r = size * 0.18;
      // Rounded rect check
      const inRect =
        (x >= r && x <= size - r) ||
        (y >= r && y <= size - r) ||
        (Math.hypot(x - r, y - r) <= r) ||
        (Math.hypot(x - (size - r), y - r) <= r) ||
        (Math.hypot(x - r, y - (size - r)) <= r) ||
        (Math.hypot(x - (size - r), y - (size - r)) <= r);

      if (inRect && x >= 0 && x < size && y >= 0 && y < size) {
        // Red background
        pixels[idx]     = 0xdc; // R
        pixels[idx + 1] = 0x26; // G
        pixels[idx + 2] = 0x26; // B
        pixels[idx + 3] = 0xff; // A
      } else {
        // Transparent
        pixels[idx] = pixels[idx+1] = pixels[idx+2] = pixels[idx+3] = 0;
      }
    }
  }

  // Draw "112" text using simple pixel font
  drawText(pixels, size, '112', Math.floor(size * 0.38));

  // Build PNG
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137,80,78,71,13,10,26,10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT — raw scanlines
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter byte
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(raw);
  chunks.push(makeChunk('IDAT', compressed));

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  fs.writeFileSync(filePath, Buffer.concat(chunks));
  console.log('✅ Generated:', filePath, `(${size}x${size})`);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = makeCRCTable();
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) | 0;
}

function makeCRCTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}

// Simple bitmap font for digits
const FONT = {
  '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'],
  '0': ['111','101','101','101','111'],
};

function drawText(pixels, size, text, fontSize) {
  const charW = Math.floor(fontSize * 0.45);
  const charH = fontSize;
  const gap = Math.floor(charW * 0.3);
  const totalW = text.length * charW + (text.length - 1) * gap;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - charH) / 2);

  for (let ci = 0; ci < text.length; ci++) {
    const ch = FONT[text[ci]];
    if (!ch) continue;
    const rows = ch.length;
    const cols = ch[0].length;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (ch[row][col] === '1') {
          const px = startX + ci * (charW + gap) + Math.floor(col * charW / cols);
          const py = startY + Math.floor(row * charH / rows);
          const bw = Math.max(1, Math.floor(charW / cols));
          const bh = Math.max(1, Math.floor(charH / rows));
          for (let dy = 0; dy < bh; dy++) {
            for (let dx = 0; dx < bw; dx++) {
              const x = px + dx, y = py + dy;
              if (x >= 0 && x < size && y >= 0 && y < size) {
                const idx = (y * size + x) * 4;
                pixels[idx] = 0xff;
                pixels[idx+1] = 0xff;
                pixels[idx+2] = 0xff;
                pixels[idx+3] = 0xff;
              }
            }
          }
        }
      }
    }
  }
}

writePNG(192, 'public/icons/icon-192.png');
writePNG(512, 'public/icons/icon-512.png');
