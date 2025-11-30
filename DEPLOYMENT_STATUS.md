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
    console.log(`✅ 已创建目录：${dir}`);
  } else {
    console.log(`✓ 目录已存在：${dir}`);
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
   - 首次部署步骤

2. **完整指南** → `CLOUDFLARE_DEPLOYMENT.md`
   - 详细的配置说明
   - API 端点文档
   - 常见问题解答

3. **官方文档**
   - [Cloudflare Pages](https://developers.cloudflare.com/pages/)
   - [Pages Functions](https://developers.cloudflare.com/pages/functions/)

## 🎯 三种部署方式

### 方式 1️⃣: Cloudflare Dashboard (推荐新手)
**优点**: 无需命令行，直观界面  
**步骤**: 连接 Git → 配置构建 → 自动部署

### 方式 2️⃣: 命令行 (CLI)
**优点**: 快速重复部署  
**命令**: `npm run cf:deploy`

### 方式 3️⃣: GitHub Actions (推荐生产)
**优点**: 完全自动化，每次推送自动部署  
**配置**: 设置 Secrets 后自动工作

## 🔍 部署后验证

```bash
# 访问网站
https://your-project.pages.dev

# 测试 API
https://your-project.pages.dev/api/health
# 应返回: {"status":"ok","message":"GK-Mixer API is running"}
```

## 💡 关键要点

### Functions 文件命名规则
```
/functions/api/users.js     → /api/users
/functions/api/colors.js    → /api/colors
/functions/export/pdf.js    → /export/pdf
```

### 环境变量访问
```javascript
export async function onRequest(context) {
  const apiKey = context.env.API_KEY;
  // ... 使用环境变量
}
```

### CORS 支持
已在 `colors.js` 中实现了 CORS 处理，可跨域访问 API

## ⚠️ 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| 404 错误 | 检查 `_routes.json` 路由配置 |
| 环境变量未读取 | 确认在 Dashboard 中设置了变量 |
| CORS 错误 | 检查 API 是否返回 CORS 头 |
| Functions 无法部署 | 检查文件名和路径是否正确 |

## 📞 技术支持

- 🐛 遇到问题？查看 `CLOUDFLARE_DEPLOYMENT.md` 的常见问题部分
- 📚 官方文档：https://developers.cloudflare.com
- 💬 社区支持：Cloudflare 论坛和 Discord

## 🎉 下一步

1. ✅ 完成初始部署
2. ✅ 配置自定义域名
3. ✅ 添加 SSL/TLS 证书
4. ✅ 启用 Web Analytics
5. ✅ 优化性能（缓存、CDN）

---

**部署配置时间**: 2025-11-30  
**配置完成度**: 100%  
**建议状态**: 已准备好进行第一次部署！🚀
