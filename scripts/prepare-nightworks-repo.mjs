#!/usr/bin/env node
/**
 * Prepares the standalone Night Works (夜之工坊) single-brand web repository
 * from `GK-Mixer-miniwebtools-main`.
 *
 * Usage:
 *   node scripts/prepare-nightworks-repo.mjs <output-dir>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const webSrcDir = path.join(repoRoot, "GK-Mixer-miniwebtools-main");

const targetDirArg = process.argv[2];
if (!targetDirArg) {
  console.error("Usage: node scripts/prepare-nightworks-repo.mjs <output-dir>");
  process.exit(1);
}
const outDir = path.resolve(targetDirArg);

const EXCLUDED_TOP_ITEMS = new Set([
  "node_modules",
  "dist",
  "dist-ssr",
  ".wrangler",
  ".git",
  ".agent",
  "android",
  "native",
  "capacitor.config.json",
  "capacitor.config.ts",
  ".env",
  ".env.local",
  ".DS_Store",
]);

function copyRecursive(src, dest, relPath = "") {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === ".DS_Store") continue;
      const entryRel = relPath ? `${relPath}/${entry}` : entry;
      if (!relPath && EXCLUDED_TOP_ITEMS.has(entry)) continue;
      if (entryRel === ".github/workflows/build-apk.yml") continue;
      if (
        entryRel.startsWith("public/paints/") &&
        entryRel !== "public/paints/nightworks" &&
        !entryRel.startsWith("public/paints/nightworks/")
      ) {
        continue;
      }
      copyRecursive(path.join(src, entry), path.join(dest, entry), entryRel);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log(`[prepare-nightworks] Cleaning and copying web project to ${outDir}...`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
copyRecursive(webSrcDir, outDir);

// 1. Lock DEFAULT_BRAND_EDITION = "Night Works" in utils/brandEdition.ts
const brandEditionPath = path.join(outDir, "utils", "brandEdition.ts");
let brandEditionCode = fs.readFileSync(brandEditionPath, "utf8");
brandEditionCode = brandEditionCode.replace(
  'export const DEFAULT_BRAND_EDITION: BrandEdition = "ALL";',
  'export const DEFAULT_BRAND_EDITION: BrandEdition = "Night Works";'
);
fs.writeFileSync(brandEditionPath, brandEditionCode, "utf8");

// 2. Filter public/PaintCatalog.json strictly to "Night Works"
const catalogPath = path.join(outDir, "public", "PaintCatalog.json");
const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const nwPaints = (catalogRaw.paints ?? []).filter(
  (p) => p && p.brand === "Night Works"
);
const filteredCatalog = {
  version: catalogRaw.version ?? 1,
  edition: "Night Works",
  count: nwPaints.length,
  paints: nwPaints,
};
fs.writeFileSync(catalogPath, JSON.stringify(filteredCatalog, null, 2), "utf8");
console.log(
  `[prepare-nightworks] Filtered PaintCatalog.json: ${nwPaints.length} Night Works paints kept (removed ${(catalogRaw.paints?.length ?? 0) - nwPaints.length} other-brand paints).`
);

// 3. Clean package.json, wrangler.toml, and .github/workflows/deploy.yml
const pkgPath = path.join(outDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.name = "gk-mixer-nightworks";
delete pkg.scripts["build:ios-algorithms"];
delete pkg.scripts["dev:nightworks"];
delete pkg.scripts["sync:nightworks"];
delete pkg.scripts["cap:copy"];
delete pkg.scripts["cap:sync"];
delete pkg.scripts["cap:open"];
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

const wranglerPath = path.join(outDir, "wrangler.toml");
const wranglerContent = `name = "gk-mixer-nightworks"
compatibility_date = "2024-12-01"

[assets]
directory = "./dist"
`;
fs.writeFileSync(wranglerPath, wranglerContent, "utf8");

const subDeployWorkflowPath = path.join(outDir, ".github", "workflows", "deploy.yml");
if (fs.existsSync(subDeployWorkflowPath)) {
  const wfContent = fs
    .readFileSync(subDeployWorkflowPath, "utf8")
    .replace(/--project-name=gkcolor-mixer/g, "--project-name=gk-mixer-nightworks");
  fs.writeFileSync(subDeployWorkflowPath, wfContent, "utf8");
}

// 4. Write clean README.md & proprietary LICENSE
const readmeContent = `# GK-Mixer · Night Works (夜之工坊) 专享版

本项目为 **Night Works (夜之工坊)** 定制的智能模型配色、手涂/湿盘混色模拟与悬浮色卡标注导出工具。

## 核心特性

- **夜之工坊全系列色卡库**：内置夜之工坊（薄涂漆、底涂漆、对比漆、笔涂金属漆、阴影洗漆、滤镜罩染漆、笔涂荧光色、特效漆、战棋水补土及预调喷涂系列）共 ${nwPaints.length} 款标准色号与实拍瓶身预览。
- **手涂与湿盘调色优先**：针对手涂/笔涂工作流优化筛选器、直涂与明暗微调配方推荐。
- **悬浮色卡标注与高清导出**：支持在模型照片或设定图上取色、自动匹配夜之工坊近似色号、拖拽排布悬浮色卡并导出高清配色图纸。
- **Mixbox 2.0 物理颜料混色模拟**：支持真实颜料潜空间（Latent Space）双漆混色、色阶过渡与反演配方计算。

## 本地运行与构建

\`\`\`bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器
npm run dev

# 3. 构建生产环境静态产物 (输出至 dist/ 目录)
npm run build
\`\`\`

## 版权与授权声明 (Proprietary License)

Copyright © NightWorks & GK-Mixer. All Rights Reserved.
本代码仓库为闭源商业授权定制项目，仅供授权品牌方查看、下载及内部部署使用。未经书面许可，禁止公开开源、二次分发或用于其他商业品牌。
`;
fs.writeFileSync(path.join(outDir, "README.md"), readmeContent, "utf8");

const licenseContent = `PROPRIETARY SOFTWARE LICENSE

Copyright (c) ${new Date().getFullYear()} GK-Mixer & Night Works (夜之工坊). All Rights Reserved.

This source code and its associated data files are proprietary and confidential.
Authorized brand partners in the GK-mixer-Distribution-Network organization are granted
permission to view, download, and build this repository for authorized brand use only.

Public redistribution, open-sourcing, sublicensing, or use with third-party paint brands
without prior written permission is strictly prohibited.
`;
fs.writeFileSync(path.join(outDir, "LICENSE"), licenseContent, "utf8");

console.log("[prepare-nightworks] Done!");
