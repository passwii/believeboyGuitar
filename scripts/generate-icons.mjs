#!/usr/bin/env node
/**
 * 生成 PWA 图标（无第三方依赖）。
 *
 * 用法：node scripts/generate-icons.mjs
 * 输出：public/icons/*.png —— 192 / 512（any）、512（maskable）、180（apple-touch）、32（favicon）
 *
 * 为什么手写 PNG：仓库刻意保持零图片依赖，图标又必须放进版本库（静态导出时
 * public/ 原样拷贝）。这里用 zlib 直接编码 RGBA 扫描线，4×4 超采样做抗锯齿，
 * 画的就是 DESIGN.md 里那两块颜色：暖纸白画布 + 锈橙节拍器。
 *
 * 改图标就改下面的 SHAPES，重新跑一遍；不要手改 PNG。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** 设计坐标固定 512×512，按目标尺寸缩放 */
const DESIGN = 512;
const CANVAS = [243, 240, 232]; // --color-canvas #f3f0e8
const RUST = [158, 59, 38]; // --color-accent-700 #9e3b26

// ---------------------------------------------------------------- 形状

function inPolygon([px, py], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const shapes = [
  // 底座
  {
    color: RUST,
    hit: (p) => {
      const [x, y] = p;
      return x >= 146 && x <= 366 && y >= 392 && y <= 432;
    },
  },
  // 箱体：上窄下宽的梯形
  {
    color: RUST,
    hit: (p) => inPolygon(p, [
      [212, 130],
      [300, 130],
      [352, 400],
      [160, 400],
    ]),
  },
  // 顶盖（圆角靠超采样自然平滑）
  {
    color: RUST,
    hit: (p) => p[0] >= 206 && p[0] <= 306 && p[1] >= 116 && p[1] <= 146,
  },
  // 摆杆：奶油色胶囊
  {
    color: CANVAS,
    hit: (p) => distanceToSegment(p, [256, 400], [296, 158]) <= 6,
  },
  // 摆锤
  {
    color: CANVAS,
    hit: (p) => Math.hypot(p[0] - 281, p[1] - 264) <= 25,
  },
];

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
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

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 渲染

/**
 * @param {number} size 目标边长
 * @param {{ scale?: number; simplify?: boolean }} options
 *   scale: 把图形整体缩到中间（maskable 安全区用）；simplify: 小尺寸去掉摆杆细节
 */
function render(size, { scale = 1, simplify = false } = {}) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const active = shapes.filter((shape) => !(simplify && shape.color === CANVAS));
  const center = DESIGN / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          // 设计坐标：目标像素 → 512 空间，再按 scale 围绕中心缩放
          const designX = (((x + (sx + 0.5) / samples) / size) * DESIGN - center) / scale + center;
          const designY = (((y + (sy + 0.5) / samples) / size) * DESIGN - center) / scale + center;

          let color = CANVAS;
          for (const shape of active) {
            if (shape.hit([designX, designY])) color = shape.color;
          }
          red += color[0];
          green += color[1];
          blue += color[2];
        }
      }

      const total = samples * samples;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(red / total);
      pixels[offset + 1] = Math.round(green / total);
      pixels[offset + 2] = Math.round(blue / total);
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  { file: "icon-192.png", size: 192, options: {} },
  { file: "icon-512.png", size: 512, options: {} },
  // maskable：图形缩到安全区（直径 80% 的圆）以内，底色铺满
  { file: "icon-maskable-512.png", size: 512, options: { scale: 0.78 } },
  // iOS 会自己切圆角，所以这里不缩、圆角交给系统
  { file: "apple-touch-icon.png", size: 180, options: {} },
  // 标签页图标太小，去掉摆杆只留轮廓
  { file: "favicon-32.png", size: 32, options: { simplify: true } },
];

for (const { file, size, options } of outputs) {
  writeFileSync(join(OUT_DIR, file), render(size, options));
  console.log(`wrote public/icons/${file} (${size}×${size})`);
}
