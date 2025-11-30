#!/usr/bin/env node

/**
 * GK-Mixer Cloudflare Pages 初始化脚本
 * 用法：node scripts/init-cloudflare.js
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'wrangler.toml',
  'functions/_routes.json',
  'functions/api/health.js',
  'functions/api/colors.js',
  '.env.example'
];

const requiredDirs = [
  'functions',
  'functions/api'
];

console.log('🚀 初始化 Cloudflare Pages 配置...\n');

// 检查必要的目录
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ 已创建目录: ${dir}`);
  } else {
    console.log(`✓ 目录已存在: ${dir}`);
  }
});

console.log('\n✅ 初始化完成！\n');

console.log('📋 后续步骤：\n');
console.log('1. 配置 .env.local 文件：');
console.log('   cp .env.example .env.local');
console.log('   # 编辑 .env.local，添加你的 Gemini API Key\n');

console.log('2. 登录 Cloudflare：');
console.log('   npx wrangler login\n');

console.log('3. 本地测试：');
console.log('   npm run dev\n');

console.log('4. 部署到 Cloudflare Pages：');
console.log('   npm run cf:deploy\n');

console.log('📖 更多信息请查看：CLOUDFLARE_DEPLOYMENT.md\n');
