import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createCanvas, GlobalFonts, loadImage } from '/Users/krooshuang/.npm/_npx/18a971dee120d222/node_modules/@napi-rs/canvas/index.js';

// Register fonts
const fontDir = '/Users/krooshuang/.npm/_npx/18a971dee120d222/node_modules/goldie/assets/fonts';
GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansSC-700.otf'), 'Noto Sans SC');
GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansSC-400.otf'), 'Noto Sans SC');

const CANVAS_WIDTH = 2048;
const CANVAS_HEIGHT = 2732;

const scenes = [
  {
    id: '01-color-picker',
    rawFile: 'color-picker.png',
    headline: '拍照取色，一键识别',
    subhead: '从模型照片精准提取颜色，自动匹配最近似油漆'
  },
  {
    id: '02-card-adjust',
    rawFile: 'card-adjust.png',
    headline: '色卡精调，所见即所得',
    subhead: '自由调整色卡位置与排列，完美呈现配色方案'
  },
  {
    id: '03-basic-mixing',
    rawFile: 'basic-mixing.png',
    headline: '基础调色，直觉操控',
    subhead: '滑动调节基础颜料比例，实时预览混合结果'
  },
  {
    id: '04-custom-mixing',
    rawFile: 'custom-mixing.png',
    headline: '自选调色，精确配方',
    subhead: '自由添加品牌油漆混色，RAL 色号智能匹配'
  },
  {
    id: '05-paint-database',
    rawFile: 'paint-database.png',
    headline: '全品牌油漆库',
    subhead: '盖亚、匠域、喵匠等主流品牌色号一网打尽'
  },
  {
    id: '06-palette',
    rawFile: 'palette.png',
    headline: '调色板，灵感收藏',
    subhead: '收藏常用颜色，跨品牌比对一目了然'
  },
  {
    id: '07-paint-detail',
    rawFile: 'paint-detail.png',
    headline: '色号详情，一目了然',
    subhead: '查看油漆详细信息，HEX、光泽、品牌一应俱全'
  },
  {
    id: '08-mixbox-formula',
    rawFile: 'mixbox-formula.png',
    headline: 'Mixbox 专业配方',
    subhead: '分层用量可视化，精确到毫升和滴数比'
  }
];

const RAW_DIR = '/Users/krooshuang/code/ios-GK-mixer/goldie/out/raw/iphone-6.9/en-US';
const OUT_DIR = '/Users/krooshuang/code/ios-GK-mixer/app_store_screenshots/ipad-13';
const BACKUP_OUT_DIR = '/Users/krooshuang/code/ios-GK-mixer/goldie/out/screenshots/ipad-13/en-US';

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(BACKUP_OUT_DIR, { recursive: true });

async function renderScene(scene) {
  console.log(`Rendering iPad scene: ${scene.id}...`);
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Background gradient (Identical warm aesthetic to iPhone)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.35, '#FFF8F2');
  grad.addColorStop(1, '#FFF0E6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Headlines
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Headline
  ctx.font = '700 82px "Noto Sans SC"';
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(scene.headline, CANVAS_WIDTH / 2, 270);

  // Subhead
  ctx.font = '400 40px "Noto Sans SC"';
  ctx.fillStyle = '#6B6B6B';
  ctx.fillText(scene.subhead, CANVAS_WIDTH / 2, 355);

  // 3. Central Framed Device
  const rawPath = path.join(RAW_DIR, scene.rawFile);
  const screenImg = await loadImage(rawPath);
  const bezelImg = await loadImage('/Users/krooshuang/.npm/_npx/18a971dee120d222/node_modules/goldie/assets/17-pro-silver.png');

  // Exact FRAME geometry from Goldie
  const FRAME_WIDTH = 606;
  const FRAME_HEIGHT = 1252;
  const SCREEN_X = 24;
  const SCREEN_Y = 21;
  const SCREEN_W = 557;
  const SCREEN_H = 1210;
  const SCREEN_RADIUS = 82;

  // Scale device to fit beautifully on 2048x2732 iPad Pro canvas
  const devWidth = 1040;
  const scale = devWidth / FRAME_WIDTH;
  const devHeight = FRAME_HEIGHT * scale;
  const frameLeft = (CANVAS_WIDTH - devWidth) / 2;
  const frameTop = 480;

  const screenLeft = frameLeft + SCREEN_X * scale;
  const screenTop = frameTop + SCREEN_Y * scale;
  const screenWidth = SCREEN_W * scale;
  const screenHeight = SCREEN_H * scale;
  const screenRadius = SCREEN_RADIUS * scale;

  // Realistic layered ambient drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 32;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(screenLeft, screenTop, screenWidth, screenHeight, screenRadius);
  ctx.fill();
  ctx.restore();

  // Draw Screen Image clipped to device screen geometry
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenLeft, screenTop, screenWidth, screenHeight, screenRadius);
  ctx.clip();
  ctx.drawImage(screenImg, screenLeft, screenTop, screenWidth, screenHeight);
  ctx.restore();

  // Draw Titanium Bezel Overlay
  ctx.save();
  ctx.drawImage(bezelImg, frameLeft, frameTop, devWidth, devHeight);
  ctx.restore();

  // 4. Save PNG without alpha channel using ffmpeg (Apple Requirement)
  const tempPng = path.join(OUT_DIR, `.${scene.id}.tmp.png`);
  const finalPng = path.join(OUT_DIR, `${scene.id}.png`);

  const buffer = await canvas.encode('png');
  fs.writeFileSync(tempPng, buffer);

  execSync(`ffmpeg -y -loglevel error -i "${tempPng}" -pix_fmt rgb24 "${finalPng}"`);
  fs.copyFileSync(finalPng, path.join(BACKUP_OUT_DIR, `${scene.id}.png`));
  fs.unlinkSync(tempPng);
  console.log(`Saved: ${finalPng}`);
}

async function main() {
  for (const scene of scenes) {
    await renderScene(scene);
  }
  console.log('All iPad 13-inch screenshots generated successfully!');
}

main().catch(console.error);
