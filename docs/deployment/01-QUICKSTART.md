# 快速部署参考

## ⚠️ 重要: 正确的部署方式

**使用 Cloudflare Dashboard 部署（推荐）**，不要使用命令行 `wrangler deploy`。

## 🚀 首次部署步骤 (5 Steps)

### Step 1: 准备本地环境
```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，添加你的 API_KEY
# API_KEY=your_gemini_api_key_here
```

### Step 2: 推送代码到 GitHub
```bash
git add .
git commit -m "Deploy to Cloudflare Pages"
git push origin main
```

### Step 3: 在 Cloudflare Dashboard 中部署 ⭐ 推荐方式

1. 登录 https://dash.cloudflare.com
2. 进入 **Workers & Pages** → **Pages**
3. 点击 **创建项目** → **连接到 Git**
4. 授权 GitHub，选择 `GK-Mixer-miniwebtools` 仓库
5. 配置构建设置：
   ```
   框架预设: None
   构建命令: npm run build
   构建输出目录: dist
   ```
6. 点击 **保存并部署**

### Step 4: 配置环境变量

部署后，在 **Settings** → **Environment variables** 中添加：
```
API_KEY=your_gemini_api_key_here
```

### Step 5: 访问网站

部署完成后，访问：
```
https://your-project.pages.dev
```

## 📝 API 端点

部署后可以访问以下 API：

```
GET  /api/health
POST /api/colors
```

### 测试 API

```bash
# 测试健康检查
curl https://your-site.pages.dev/api/health

# 测试颜色 API
curl -X POST https://your-site.pages.dev/api/colors \
  -H "Content-Type: application/json" \
  -d '{"colors": ["#FF0000", "#00FF00"]}'
```

## 🧪 本地开发 & 测试

### 开发模式
```bash
npm run dev
# 访问 http://localhost:5173
```

### 生产构建
```bash
npm run build
npm run preview
# 访问 http://localhost:4173
```

### 本地测试 Functions
```bash
npm run cf:dev
# 访问 http://localhost:8788
```

## 🔧 添加新的 API 函数

在 `/functions/api/` 中创建新文件：

```javascript
// /functions/api/export.js
export async function onRequest(context) {
  return new Response(JSON.stringify({ message: 'Export API' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

自动路由生成：
- `/functions/api/export.js` → `GET/POST /api/export`

## 🌍 环境变量

在 Cloudflare Dashboard 中设置（**Settings** → **Environment variables**）：

| 变量名 | 用途 | 示例 |
|-------|------|------|
| `API_KEY` | Gemini API Key | `sk-...` |

## ⚠️ 常见问题

### Q: 如何获取 Cloudflare API Token？
A: Dashboard → 用户个人资料 → API 令牌 → 创建令牌

### Q: Functions 无法访问环境变量？
A: 确保在 Dashboard 的 Pages 项目 Settings 中添加了环境变量

### Q: 本地开发无法测试 Functions？
A: 使用 `npm run cf:dev` 启动本地 Cloudflare 环境

### Q: 如何添加自定义域名？
A: Dashboard → Pages 项目 → Settings → Custom domains

## 💡 最佳实践

1. ✅ 始终使用 `.env.local` 管理本地密钥
2. ✅ 测试 API 在生产前
3. ✅ 监控部署日志
4. ✅ 定期检查环境变量

## 📚 相关文档

| 文档 | 内容 |
|------|------|
| [00-GUIDE.md](./00-GUIDE.md) | 完整部署指南 |
| [01-TROUBLESHOOT.md](./01-TROUBLESHOOT.md) | 故障排除 |
| [02-SETUP.md](./02-SETUP.md) | 初始化配置 |
