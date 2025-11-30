# Cloudflare Pages 部署指南

## 快速开始

### 前置条件
- 拥有 Cloudflare 账户
- 安装 Node.js 和 npm
- 项目代码已推送到 GitHub/GitLab/Gitea

### 部署步骤

#### 1. 使用 Cloudflare Dashboard 部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Pages** 菜单
3. 点击 **创建项目** → **连接到 Git**
4. 选择你的 Git 仓库
5. 配置构建设置：
   - **框架预设**：选择 `React` 或 `None`
   - **构建命令**：`npm run build`
   - **构建输出目录**：`dist`
   - **环境变量**：添加 `API_KEY`（Gemini API key）

6. 点击 **保存并部署**

#### 2. 环境变量配置

在 Cloudflare Dashboard 中设置以下环境变量：

```
API_KEY=your_gemini_api_key_here
```

### Functions 配置

项目已配置了 Cloudflare Pages Functions：

```
/functions
├── _routes.json          # 路由配置
└── api/
    └── health.js         # 健康检查 API (GET /api/health)
```

#### API 端点

- **健康检查**：`GET /api/health`
  - 响应：`{ status: 'ok', message: 'GK-Mixer API is running' }`

### 本地开发

#### 安装 Wrangler CLI
```bash
npm install -g wrangler
```

#### 本地运行
```bash
npm run dev
# 访问 http://localhost:5173
```

#### 本地测试 Functions
```bash
wrangler pages dev dist
# 访问 http://localhost:8788
```

### 项目结构

```
GK-Mixer-miniwebtools/
├── dist/                 # 构建输出（Cloudflare Pages 静态文件）
├── functions/            # Cloudflare Pages Functions
│   ├── _routes.json
│   └── api/
│       └── health.js
├── src/
│   ├── App.tsx
│   └── components/
├── wrangler.toml        # Cloudflare Workers 配置
├── vite.config.ts       # Vite 构建配置
├── package.json
└── README.md
```

### 构建流程

```bash
# 1. 安装依赖
npm install

# 2. 本地开发
npm run dev

# 3. 生产构建
npm run build

# 4. 预览生产构建
npm run preview
```

### 常见问题

#### Q: 如何更新 API_KEY？
A: 在 Cloudflare Dashboard > Pages > Settings > Environment variables 中修改

#### Q: 如何访问 Functions？
A: 路由自动生成。`/functions/api/health.js` → `https://your-site.pages.dev/api/health`

#### Q: 如何添加更多 Functions？
A: 在 `/functions` 目录中创建新的 `.js` 文件。例如：
- `/functions/api/colors.js` → `/api/colors`
- `/functions/api/export.js` → `/api/export`

#### Q: 是否支持 Node.js 模块？
A: Cloudflare Pages Functions 运行在 Workers 环境上，某些 Node.js 模块可能不兼容。建议使用浏览器兼容或专为 Workers 优化的库。

### 参考资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
