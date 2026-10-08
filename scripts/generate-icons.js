import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, isMaskable = false) {
  // Create raw RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = isMaskable ? width * 0.46 : width * 0.44;
  const innerRadius = width * 0.28;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep slate / teal corporate background gradient
      const gradRatio = (x + y) / (width + height);
      let r = Math.round(15 + gradRatio * 15);
      let g = Math.round(23 + gradRatio * 50);
      let b = Math.round(42 + gradRatio * 100);
      let a = 255;

      // Outer radar circle
      if (Math.abs(dist - outerRadius * 0.8) < width * 0.02) {
        r = 56; g = 189; b = 248; // sky-400
      } else if (Math.abs(dist - outerRadius * 0.55) < width * 0.02) {
        r = 52; g = 211; b = 153; // emerald-400
      }

      // Center Pin & Power energy icon area
      if (dist < innerRadius) {
        if (dist < innerRadius * 0.45) {
          // Central lightning/spark accent
          r = 56; g = 189; b = 248;
        } else if (dist < innerRadius * 0.8) {
          r = 5; g = 150; b = 105; // emerald-600
        } else {
          r = 14; g = 165; b = 233; // sky-500
        }
      }

      // Rounded squircle corner clipping for non-maskable icons
      if (!isMaskable) {
        const cornerRadius = width * 0.22;
        const inLeft = x < cornerRadius;
        const inRight = x > width - cornerRadius;
        const inTop = y < cornerRadius;
        const inBottom = y > height - cornerRadius;

        if ((inLeft || inRight) && (inTop || inBottom)) {
          const cornerX = inLeft ? cornerRadius : width - cornerRadius;
          const cornerY = inTop ? cornerRadius : height - cornerRadius;
          const cornerDist = Math.sqrt((x - cornerX) ** 2 + (y - cornerY) ** 2);
          if (cornerDist > cornerRadius) {
            a = 0; // Transparent outside rounded corner
          }
        }
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // Encode raw RGBA into standard PNG format
  const lines = [];
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(1 + width * 4);
    line[0] = 0; // Filter: None
    buffer.copy(line, 1, y * width * 4, (y + 1) * width * 4);
    lines.push(line);
  }
  const rawData = Buffer.concat(lines);
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const pngSig = Buffer.from([137, 80, 78, 72, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, true));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, false));
fs.writeFileSync('public/favicon.ico', createPng(32, 32, false));

console.log('PNG PWA icon assets generated successfully in public/');
