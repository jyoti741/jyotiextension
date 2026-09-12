import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const zipFile = path.resolve(distDir, 'compare-anything-extension.zip');

/**
 * Creates a valid ZIP archive without external dependencies using Node.js zlib.
 */
function createZip(sourceDir, outputFile, fileList) {
  const localFileHeaders = [];
  const centralDirHeaders = [];
  let offset = 0;

  for (const relPath of fileList) {
    const fullPath = path.join(sourceDir, relPath);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    const data = fs.readFileSync(fullPath);
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);

    // Standard normalized zip forward-slash path
    const normalizedName = relPath.replace(/\\/g, '/');
    const nameBuf = Buffer.from(normalizedName, 'utf8');

    // Local File Header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed
    localHeader.writeUInt16LE(0, 6);          // General flag
    localHeader.writeUInt16LE(8, 8);          // Compression: Deflate
    localHeader.writeUInt16LE(0, 10);         // Last mod time
    localHeader.writeUInt16LE(0, 12);         // Last mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(data.length, 22);       // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);    // Filename length
    localHeader.writeUInt16LE(0, 28);                 // Extra field length

    const fullLocal = Buffer.concat([localHeader, nameBuf, compressed]);
    localFileHeaders.push(fullLocal);

    // Central Directory Header
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4);         // Version made by
    cdHeader.writeUInt16LE(20, 6);         // Version needed
    cdHeader.writeUInt16LE(0, 8);          // General flag
    cdHeader.writeUInt16LE(8, 10);         // Compression: Deflate
    cdHeader.writeUInt16LE(0, 12);         // Last mod time
    cdHeader.writeUInt16LE(0, 14);         // Last mod date
    cdHeader.writeUInt32LE(crc, 16);       // CRC-32
    cdHeader.writeUInt32LE(compressed.length, 20); // Compressed size
    cdHeader.writeUInt32LE(data.length, 24);       // Uncompressed size
    cdHeader.writeUInt16LE(nameBuf.length, 28);    // Filename length
    cdHeader.writeUInt16LE(0, 30);                 // Extra field length
    cdHeader.writeUInt16LE(0, 32);                 // Comment length
    cdHeader.writeUInt16LE(0, 34);                 // Disk number
    cdHeader.writeUInt16LE(0, 36);                 // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);                 // External file attributes
    cdHeader.writeUInt32LE(offset, 42);            // Relative offset of local header

    centralDirHeaders.push(Buffer.concat([cdHeader, nameBuf]));

    offset += fullLocal.length;
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralDirHeaders);

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Start disk
  eocd.writeUInt16LE(centralDirHeaders.length, 8);  // Total entries on disk
  eocd.writeUInt16LE(centralDirHeaders.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirBuffer.length, 12);  // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);         // Central dir offset
  eocd.writeUInt16LE(0, 20);                        // Comment length

  const finalZipBuffer = Buffer.concat([...localFileHeaders, centralDirBuffer, eocd]);
  fs.writeFileSync(outputFile, finalZipBuffer);
}

// CRC-32 table
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

function getFilesRecursively(dir, base = '') {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);

    // Skip zips, hidden files, or laravel public items in dist
    if (
      entry.name.endsWith('.zip') ||
      entry.name.startsWith('.') ||
      entry.name.endsWith('.php') ||
      entry.name === 'robots.txt'
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(full, rel));
    } else {
      results.push(rel);
    }
  }

  return results;
}

console.log('Packaging extension from dist/...');
const extensionFiles = getFilesRecursively(distDir).filter((file) => {
  return (
    file === 'manifest.json' ||
    file.startsWith('assets/') ||
    file.startsWith('icons/') ||
    file.startsWith('src/')
  );
});

console.log('Files included in Chrome Web Store ZIP:');
extensionFiles.forEach((f) => console.log(`  + ${f}`));

createZip(distDir, zipFile, extensionFiles);
const zipStat = fs.statSync(zipFile);
console.log(`\n✓ Successfully created production ZIP for Chrome Web Store:`);
console.log(`  Path: ${zipFile}`);
console.log(`  Size: ${(zipStat.size / 1024).toFixed(1)} KB`);
