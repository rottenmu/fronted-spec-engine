#!/usr/bin/env node
/**
 * Pixel-level design token sampler for the frontend-spec-engineer skill.
 * JS port of scripts/pixel_sample.py — zero-dependency PNG decoding via
 * node:zlib, so it runs anywhere Node >= 18 exists (no sharp/jimp needed).
 *
 * Usage:
 *   node scripts/pixel_sample.mjs --image <path.png> [--grid 4] [--out tokens.json]
 *   node scripts/pixel_sample.mjs --image <path.png> \
 *       --points "label:x,y;label2:x,y" \
 *       --points-ratio "label:0.8,0.4;label2:0.05,0.03"
 *
 * Note: PNG only (8-bit, non-interlaced). For JPEG input, convert first
 * (e.g. `ffmpeg -i in.jpg out.png`) or use the Python/PIL version.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Minimal PNG decoder (8-bit, colorType 0/2/3/4/6, non-interlaced)
// ---------------------------------------------------------------------------
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a valid PNG file');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4; // skip CRC
  }

  if (!width || !height) throw new Error('PNG missing IHDR (width/height)');
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (only 8-bit PNG)`);
  if (interlace !== 0) throw new Error('interlaced PNG is not supported; re-save as non-interlaced');

  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);

  // palette for colorType 3
  let palette = null;
  offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'PLTE') {
      palette = buffer.subarray(dataStart, dataStart + length);
      break;
    }
    if (type === 'IDAT' || type === 'IEND') break;
    offset = dataStart + length + 4;
  }

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const prevRowStart = (y - 1) * (stride + 1) + 1;
    const outStart = y * width * 4;

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + x];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const up = y > 0 ? raw[prevRowStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? raw[prevRowStart + x - channels] : 0;

      let value;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + Math.floor((left + up) / 2); break;
        case 4: value = rawByte + paeth(left, up, upLeft); break;
        default: throw new Error(`invalid PNG filter ${filter}`);
      }
      raw[rowStart + x] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const inIdx = rowStart + x * channels;
      const outIdx = outStart + x * 4;
      let r, g, b, a = 255;
      switch (colorType) {
        case 0: // grayscale
          r = g = b = raw[inIdx];
          break;
        case 2: // RGB
          r = raw[inIdx];
          g = raw[inIdx + 1];
          b = raw[inIdx + 2];
          break;
        case 3: { // palette
          const idx = raw[inIdx] * 3;
          if (palette && idx + 2 < palette.length) {
            r = palette[idx];
            g = palette[idx + 1];
            b = palette[idx + 2];
          } else {
            r = g = b = 0;
          }
          break;
        }
        case 4: // gray + alpha
          r = g = b = raw[inIdx];
          a = raw[inIdx + 1];
          break;
        case 6: // RGBA
          r = raw[inIdx];
          g = raw[inIdx + 1];
          b = raw[inIdx + 2];
          a = raw[inIdx + 3];
          break;
        default:
          r = g = b = 0;
      }
      pixels[outIdx] = r;
      pixels[outIdx + 1] = g;
      pixels[outIdx + 2] = b;
      pixels[outIdx + 3] = a;
    }
  }

  return { width, height, pixels };
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------
function hexOf(px) {
  return `#${px[0].toString(16).padStart(2, '0')}${px[1].toString(16).padStart(2, '0')}${px[2].toString(16).padStart(2, '0')}`;
}

function getPixel(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, x));
  y = Math.max(0, Math.min(img.height - 1, y));
  const idx = (y * img.width + x) * 4;
  return [img.pixels[idx], img.pixels[idx + 1], img.pixels[idx + 2], img.pixels[idx + 3]];
}

function parsePoints(spec, width, height, ratio) {
  const points = {};
  if (!spec) return points;
  for (const chunk of spec.split(';')) {
    const trimmed = chunk.trim();
    if (!trimmed || !trimmed.includes(':')) continue;
    const [label, coord] = trimmed.split(':', 2);
    const parts = coord.split(',').map((v) => parseFloat(v.trim()));
    if (parts.length < 2 || parts.some(Number.isNaN)) continue;
    const x = ratio ? Math.round(parts[0] * width) : Math.round(parts[0]);
    const y = ratio ? Math.round(parts[1] * height) : Math.round(parts[1]);
    points[label.trim()] = { x, y };
  }
  return points;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] !== undefined ? args[idx + 1] : '';
}

function main() {
  const args = process.argv.slice(2);
  const imagePath = path.resolve(argValue(args, '--image'));
  const pointsSpec = argValue(args, '--points');
  const pointsRatioSpec = argValue(args, '--points-ratio');
  const grid = Number(argValue(args, '--grid') || '0');
  const outPath = argValue(args, '--out');

  if (!imagePath || !fs.existsSync(imagePath)) {
    console.error('Usage: node pixel_sample.mjs --image <path.png> [--points ...] [--points-ratio ...] [--grid N] [--out file.json]');
    process.exit(1);
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === '.png') {
    var img = decodePng(buffer);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    console.error('JPEG is not supported by the zero-dependency decoder. Convert to PNG first, e.g.:');
    console.error('  ffmpeg -i input.jpg output.png');
    console.error('or use the Python version: python scripts/pixel_sample.py --image input.jpg');
    process.exit(1);
  } else {
    console.error(`Unsupported image type "${ext}". Only .png is supported.`);
    process.exit(1);
  }

  const { width, height } = img;
  console.log(`image: ${imagePath}  ${width}x${height}`);
  const result = {};

  for (const [label, { x, y }] of Object.entries(parsePoints(pointsSpec, width, height, false))) {
    result[label] = hexOf(getPixel(img, x, y));
    console.log(`  ${label.padEnd(28)} (${x},${y}) -> ${result[label]}`);
  }
  for (const [label, { x, y }] of Object.entries(parsePoints(pointsRatioSpec, width, height, true))) {
    result[label] = hexOf(getPixel(img, x, y));
    console.log(`  ${label.padEnd(28)} ratio(${x},${y}) -> ${result[label]}`);
  }

  if (grid > 1) {
    const stepX = Math.max(1, Math.floor(width / grid));
    const stepY = Math.max(1, Math.floor(height / grid));
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const x0 = gx * stepX;
        const y0 = gy * stepY;
        const x1 = Math.min(width, x0 + stepX);
        const y1 = Math.min(height, y0 + stepY);
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const [r, g, b] = getPixel(img, xx, yy);
            rSum += r; gSum += g; bSum += b; count++;
          }
        }
        const avg = [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
        const label = `grid_${gy}_${gx}`;
        result[label] = hexOf(avg);
        console.log(`  ${label.padEnd(28)} cell(${x0},${y0},${x1},${y1}) -> ${result[label]}`);
      }
    }
  }

  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2), 'utf-8');
    console.log(`saved: ${outPath}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
