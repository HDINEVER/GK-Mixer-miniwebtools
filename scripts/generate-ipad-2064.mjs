import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createCanvas, GlobalFonts, loadImage } from '/Users/krooshuang/.npm/_npx/18a971dee120d222/node_modules/@napi-rs/canvas/index.js';

// Register fonts
const fontDir = '/Users/krooshuang/.npm/_npx/18a971dee120d222/node_modules/goldie/assets/fonts';
GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansSC-700.otf'), 'Noto Sans SC');
GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansSC-400.otf'), 'Noto Sans SC');

const CANVAS_WIDTH = 2064;
const CANVAS_HEIGHT = 2752;

const RAW_DIR = '/Users/krooshuang/code/ios-GK-mixer/goldie/out/raw/ipad-raw';
const OUT_FRAMED = '/Users/krooshuang/code/ios-GK-mixer/app_store_screenshots/ipad-2064x2752/framed';
const OUT_FULL = '/Users/krooshuang/code/ios-GK-mixer/app_store_screenshots/ipad-2064x2752/fullscreen';

fs.mkdirSync(OUT_FRAMED, { recursive: true });
fs.mkdirSync(OUT_FULL, { recursive: true });

const scenes = [
  {
    id: '01-card-adjust',
    file: '01-card-adjust.png',
    headline: '色卡精调，所见即所得',
    subhead: '自由调整引线位置与色卡排版，完美呈现配色方案'
  },
  {
    id: '02-professional-mixer',
    file: '02-professional-mixer.png',
    headline: '专业混色，精确到滴',
    subhead: '分层混色瓶实时可视化，智能计算各色毫升与滴数比'
  },
  {
    id: '03-custom-mixing',
    file: '03-custom-mixing.png',
    headline: '智能匹配，自选调色',
    subhead: '多品牌色号智能检索与色差比对，配方一键生成'
  },
  {
    id: '04-paint-database',
    file: '04-paint-database.png',
    headline: '全品牌油漆数据库',
    subhead: '涵盖盖亚、匠域、郡士、田宫等主流模型品牌全色系'
  },
  {
    id: '05-paint-detail',
    file: '05-paint-detail.png',
    headline: '色号详情，跨品牌互查',
    subhead: '色号参数完整呈现，社区对照色号轻松替换'
  }
];

async function renderFramed(scene) {
  console.log(`Rendering framed iPad 2064x2752: ${scene.id}...`);
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Background gradient (Identical warm aesthetic)
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
  ctx.font = '700 86px "Noto Sans SC"';
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(scene.headline, CANVAS_WIDTH / 2, 270);

  // Subhead
  ctx.font = '400 42px "Noto Sans SC"';
  ctx.fillStyle = '#6B6B6B';
  ctx.fillText(scene.subhead, CANVAS_WIDTH / 2, 360);

  // 3. iPad Tablet Frame & Content
  const rawPath = path.join(RAW_DIR, scene.file);
  const screenImg = await loadImage(rawPath);

  // Tablet dimensions
  // Aspect ratio of screenImg: 1668 / 2420 = 0.689256
  const screenH = 2020;
  const screenW = Math.round(screenH * (screenImg.width / screenImg.height)); // ~1392px
  const bezelThickness = 24;
  const outerW = screenW + bezelThickness * 2;
  const outerH = screenH + bezelThickness * 2;

  const outerLeft = (CANVAS_WIDTH - outerW) / 2;
  const outerTop = 460;
  const screenLeft = outerLeft + bezelThickness;
  const screenTop = outerTop + bezelThickness;

  const outerRadius = 54;
  const screenRadius = 40;

  // Outer ambient shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 38;
  ctx.fillStyle = '#1C1C1E';
  ctx.beginPath();
  ctx.roundRect(outerLeft, outerTop, outerW, outerH, outerRadius);
  ctx.fill();
  ctx.restore();

  // Contact shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#1C1C1E';
  ctx.beginPath();
  ctx.roundRect(outerLeft, outerTop, outerW, outerH, outerRadius);
  ctx.fill();
  ctx.restore();

  // iPad chassis edge (metallic rim)
  ctx.save();
  const rimGrad = ctx.createLinearGradient(outerLeft, outerTop, outerLeft + outerW, outerTop + outerH);
  rimGrad.addColorStop(0, '#E5E5EA');
  rimGrad.addColorStop(0.5, '#F2F2F7');
  rimGrad.addColorStop(1, '#D1D1D6');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.roundRect(outerLeft - 3, outerTop - 3, outerW + 6, outerH + 6, outerRadius + 3);
  ctx.fill();
  ctx.restore();

  // iPad Black Bezel
  ctx.save();
  ctx.fillStyle = '#141416';
  ctx.beginPath();
  ctx.roundRect(outerLeft, outerTop, outerW, outerH, outerRadius);
  ctx.fill();

  // Front camera dot in top bezel
  const cameraX = outerLeft + outerW / 2;
  const cameraY = outerTop + bezelThickness / 2;
  ctx.fillStyle = '#08080A';
  ctx.beginPath();
  ctx.arc(cameraX, cameraY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Camera lens subtle glint
  ctx.fillStyle = '#1C2834';
  ctx.beginPath();
  ctx.arc(cameraX - 1, cameraY - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Screen Glass Clipping & Image Draw
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenLeft, screenTop, screenW, screenH, screenRadius);
  ctx.clip();
  ctx.drawImage(screenImg, screenLeft, screenTop, screenW, screenH);
  ctx.restore();

  // 4. Save PNG without alpha channel using ffmpeg (Apple Requirement)
  const tempPng = path.join(OUT_FRAMED, `.${scene.id}.tmp.png`);
  const finalPng = path.join(OUT_FRAMED, `${scene.id}.png`);

  const buffer = await canvas.encode('png');
  fs.writeFileSync(tempPng, buffer);

  execSync(`ffmpeg -y -loglevel error -i "${tempPng}" -pix_fmt rgb24 "${finalPng}"`);
  fs.unlinkSync(tempPng);
  console.log(`Saved framed: ${finalPng}`);
}

async function renderFullscreen(scene) {
  console.log(`Rendering fullscreen iPad 2064x2752: ${scene.id}...`);
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  const rawPath = path.join(RAW_DIR, scene.file);
  const screenImg = await loadImage(rawPath);

  // Draw background to avoid any gaps
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw image scaled to fill 2064x2752
  // We can scale it with slight crop or letterbox/direct fit
  // Direct fit to 2064x2752:
  ctx.drawImage(screenImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const tempPng = path.join(OUT_FULL, `.${scene.id}.tmp.png`);
  const finalPng = path.join(OUT_FULL, `${scene.id}.png`);

  const buffer = await canvas.encode('png');
  fs.writeFileSync(tempPng, buffer);

  execSync(`ffmpeg -y -loglevel error -i "${tempPng}" -pix_fmt rgb24 "${finalPng}"`);
  fs.unlinkSync(tempPng);
  console.log(`Saved fullscreen: ${finalPng}`);
}

async function main() {
  for (const scene of scenes) {
    await renderFramed(scene);
    await renderFullscreen(scene);
  }
  console.log('All 2064x2752 iPad screenshots generated successfully!');
}

main().catch(console.error);
