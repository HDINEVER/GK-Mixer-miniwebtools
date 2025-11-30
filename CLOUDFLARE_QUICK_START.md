# GK-Mixer Cloudflare Pages 配置快速参考

## ✅ 已完成的配置

### 1. 项目结构
```
✓ /functions          - Cloudflare Pages Functions 目录
✓ /functions/_routes.json  - 路由配置
✓ /functions/api/     - API 端点
  ✓ health.js         - 健康检查 API
  ✓ colors.js         - 颜色处理 API 示例
```

### 2. 配置文件
```
✓ wrangler.toml       - Cloudflare Workers 配置
✓ .env.example        - 环境变量模板
✓ package.json        - 新增部署脚本
✓ .gitignore          - 更新 Wrangler 文件排除
```

### 3. 自动化
```
✓ .github/workflows/deploy.yml  - GitHub Actions 部署工作流
✓ scripts/init-cloudflare.js    - 初始化脚本
```

## 🚀 首次部署步骤

### Step 1: 准备本地环境
```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，添加你的 API_KEY
# API_KEY=your_gemini_api_key_here
```

### Step 2: 登录 Cloudflare
```bash
# 使用 Wrangler 登录
npx wrangler login

# 这会打开浏览器进行授权
```

### Step 3: 本地测试
```bash
# 开发模式
npm run dev

# 测试生产构建
npm run build
npm run preview
```

### Step 4: 部署选项

#### 选项 A: 使用 Cloudflare Dashboard (推荐首次使用)
1. 登录 https://dash.cloudflare.com
2. 选择 **Pages**
3. **创建项目** → **连接到 Git**
4. 选择 GitHub 仓库
5. 配置构建设置：
   - 框架：None
   - 构建命令：`npm run build`
   - 构建输出目录：`dist`
6. 在 **Settings** → **Environment variables** 中添加 `API_KEY`
7. 点击 **保存并部署**

#### 选项 B: 使用命令行部署
```bash
# 需要先通过 Dashboard 连接一次 Git 仓库
npm run cf:deploy
```

#### 选项 C: 使用 GitHub Actions (自动部署)
1. 在 GitHub 仓库设置中添加 Secrets：
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `GEMINI_API_KEY`
2. 推送代码到 main 或 deploy 分支
3. GitHub Actions 自动部署

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

在 Cloudflare Dashboard 中设置：

| 变量名 | 用途 | 示例 |
|-------|------|------|
| `API_KEY` | Gemini API Key | `sk-...` |
| `ENVIRONMENT` | 环境标识 | `production` |

## ⚠️ 常见问题

### Q: 如何获取 Cloudflare API Token？
A: Dashboard → 用户个人资料 → API 令牌 → 创建令牌

### Q: Functions 无法访问环境变量？
A: 确保在 Dashboard 的 Pages 项目 Settings 中添加了环境变量

### Q: 本地开发无法测试 Functions？
A: 使用 `npm run cf:dev` 启动本地 Cloudflare 环境

### Q: GitHub Actions 部署失败？
A: 检查 Secrets 是否正确设置，特别是 API Token 的权限

## 📚 相关文档

- [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

## 💡 最佳实践

1. ✅ 始终使用 `.env.local` 管理本地密钥
2. ✅ 使用 GitHub Secrets 管理 CI/CD 部署密钥
3. ✅ 测试 API 在生产前
4. ✅ 监控部署日志
5. ✅ 定期备份重要配置

## 🎯 下一步

- [ ] 配置自定义域名
- [ ] 启用 Web Analytics
- [ ] 设置 DDoS 防护
- [ ] 配置 WAF 规则
- [ ] 实现 API 认证机制
- [ ] 添加数据库集成（D1/Durable Objects）
