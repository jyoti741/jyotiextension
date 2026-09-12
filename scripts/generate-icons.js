import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Creates a valid RGBA PNG buffer with an iconic Compare Anything logo.
 */
/**
 * Creates a valid RGBA PNG buffer with an iconic Compare Anything "C" logo.
 * Uses 4x4 supersampling for ultra-crisp, anti-aliased rendering at 16, 48, and 128px.
 */
function createPng(width, height) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  const samples = 4; // 4x4 supersampling = 16 samples per pixel

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const subX = (x + (sx + 0.5) / samples) / width;
          const subY = (y + (sy + 0.5) / samples) / height;

          // Outer circular badge
          const badgeCx = subX - 0.5;
          const badgeCy = subY - 0.5;
          const badgeDist = Math.sqrt(badgeCx * badgeCx + badgeCy * badgeCy);

          if (badgeDist <= 0.48) {
            // Gradient background: Electric Blue (#2563eb) to Deep Royal (#1d4ed8)
            const t = (subX + subY) / 2;
            let r = Math.round(37 * (1 - t * 0.3) + 29 * (t * 0.3));
            let g = Math.round(99 * (1 - t * 0.3) + 78 * (t * 0.3));
            let b = Math.round(235 * (1 - t * 0.2) + 216 * (t * 0.2));

            // Optical center of the "C" glyph (slightly right of center to compensate for the right opening)
            const isSmall = width <= 24;
            const cCenterX = isSmall ? 0.520 : 0.515;
            const cCenterY = 0.500;
            const cDx = subX - cCenterX;
            const cDy = subY - cCenterY;
            const cDist = Math.sqrt(cDx * cDx + cDy * cDy);

            // Bold "C" dimensions:
            // For 16px, use slightly bolder stroke for instant legibility in Chrome toolbar
            const outerR = isSmall ? 0.310 : 0.285;
            const innerR = isSmall ? 0.130 : 0.155;
            const mouthHalfHeight = isSmall ? 0.115 : 0.100;
            const mouthMinX = isSmall ? 0.05 : 0.08;

            const inRing = cDist >= innerR && cDist <= outerR;
            const inMouth = cDx >= mouthMinX && cDy >= -mouthHalfHeight && cDy <= mouthHalfHeight;

            // Inside "C" glyph
            if (inRing && !inMouth) {
              // Pure white bold glyph
              r = 255;
              g = 255;
              b = 255;
            } else if (badgeDist > 0.46) {
              // Subtle badge ring edge
              r = Math.round(r * 0.85);
              g = Math.round(g * 0.85);
              b = Math.round(b * 0.95);
            }

            rSum += r;
            gSum += g;
            bSum += b;
            aSum += 255;
          } else if (badgeDist <= 0.495) {
            // Anti-aliased outer circular edge
            const alphaEdge = Math.max(0, Math.min(1, (0.495 - badgeDist) / 0.015));
            rSum += 37 * alphaEdge;
            gSum += 99 * alphaEdge;
            bSum += 235 * alphaEdge;
            aSum += 255 * alphaEdge;
          }
        }
      }

      const totalSamples = samples * samples;
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = Math.round(rSum / totalSamples);
      rawData[pxOffset + 1] = Math.round(gSum / totalSamples);
      rawData[pxOffset + 2] = Math.round(bSum / totalSamples);
      rawData[pxOffset + 3] = Math.round(aSum / totalSamples);
    }
  }

  // 2. Encode to PNG binary chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT (Deflated raw image data)
  const deflated = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', deflated);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = crc32(toCrc);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

// Standard CRC32 table implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Generate icons
const sizes = [16, 48, 128];
const targetDirs = [
  path.resolve(__dirname, '../public/icons'),
  path.resolve(__dirname, '../icons'),
  path.resolve(__dirname, '../dist/icons')
];

targetDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

sizes.forEach((size) => {
  const pngBuf = createPng(size, size);
  const fileName = `icon${size}.png`;

  targetDirs.forEach((dir) => {
    fs.writeFileSync(path.join(dir, fileName), pngBuf);
  });
  console.log(`✓ Generated ${fileName} (${size}x${size} PNG)`);
});
