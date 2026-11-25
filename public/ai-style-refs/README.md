# AI Paint Studio 风格参考样板图与私有 R2 配置说明

本目录（`GK-Mixer-miniwebtools-main/public/ai-style-refs/`）用于**本地放图调试与同步上传到私有 Cloudflare R2**：
- 本目录内 [`presets.json`](./presets.json) 与本说明文件会同步进 Git；**所有 `.jpg / .jpeg / .png / .webp` 参考图片均已加入 `.gitignore` 与 Night Works 过滤脚本，绝不会推送到公开 GitHub 仓库**，从源头降低版权与公开传播风险。
- 线上生产环境通过 **私有 Cloudflare R2 Bucket (`STYLE_REFS_R2`)** 由后端 [ai-render.js](../../functions/api/ai-render.js) 私密读取后传给 Seedream，前端仅显示「云端私有风格样板已挂载」状态提示，不对外暴露原图 URL；本地运行 `npm run dev` 时仍可直接读取本目录图片并在浏览器内预览。
- 多选「战损旧化」时后端最多自动附带前 **2 张** 局部特写参考图作为 **图 2 / 图 3**；如果某个子项图暂未上传，后端会自动回退检测其主分类兜底图（如 `heavy_weathering.jpg`），仍未放置则自动剥离参考图指引词并仅靠精调提示词生成，绝不报错。

---

## 一、 全部参考图后端槽位总表（共 13 个核心槽位 + 2 个主类兜底槽位）

### A. 4 个独立主技法（放进 `public/ai-style-refs/`）

| 技法 ID | 按钮显示名称 | 文件路径 | 建议找什么样的图 |
| :--- | :--- | :--- | :--- |
| `clean_rg` | **纯色平喷** | `clean_rg.jpg` | 浅灰/纯白无影棚下的官图级平喷分色成品，发色饱满干净、零阴影晕染、半消光质感 |
| `max_shadow` | **阴影涂装** | `max_shadow.jpg` | 深色背景或杂志棚拍的经典黑底 MAX 预置阴影作品，棱角深色过渡、面心提亮明显 |
| `anime_cel` | **漫画风波点涂装** | `anime_cel.jpg` | 粗黑轮廓描边 + 硬边三层明暗色块 + 带有漫画网点/波点颗粒阴影的二次元模型作品 |
| `primer_grey` | **喷灰** | `primer_grey.jpg` | 喷完 #1000/#1200 中性灰水补土后的整机灰模展示照（**6 档补土色系共用此 1 张图**：浅灰/中灰/深灰/黑/红蜡/粉红无需另找图；务必全素灰、无红眼/透明件/金属件） |

### B. 「战损旧化涂装」5 个细分工艺子槽位（可多选叠加 · 兜底读取 `heavy_weathering.jpg`）

| 子工艺 ID | 按钮名称 | 文件路径 | 建议「局部装甲特写」画面特征 |
| :--- | :--- | :--- | :--- |
| `weathering_chipping` | **海绵/笔涂掉漆** | `weathering_chipping.jpg` | 裁剪一块肩甲/盾牌边缘特写，拍出海绵拍涂暗灰+露银双层掉漆颗粒 |
| `weathering_wash` | **水洗渍洗滤镜** | `weathering_wash.jpg` | 裁剪带铆钉与装甲凹槽的局部特写，突出油泥渗渍与竖向轻微油丝滤镜 |
| `weathering_grimdark` | **暗黑珐琅旧化** | `weathering_grimdark.jpg` | 裁剪暗棕黑珐琅擦拭过的装甲局部特写（暗角重油垢 + 受光凸面擦亮对比） |
| `weathering_drybrush` | **干扫边缘质感** | `weathering_drybrush.jpg` | 裁剪消光装甲折角或机械骨骼特写，突出硬毛笔棱边钢银色干扫磨损颗粒感 |
| `weathering_rust_mud` | **粉彩泥锈战损** | `weathering_rust_mud.jpg` | 裁剪小腿装甲或喷口周边特写，突出红褐垂直流锈水痕、烟熏黑碳与干燥泥粉尘 |

### C. 「金属/珍珠/电镀特效涂装」4 个细分工艺子槽位（互斥单选 · 兜底读取 `candy_metallic.jpg`）

| 子工艺 ID | 按钮名称 | 文件路径 | 建议「局部装甲特写」画面特征 |
| :--- | :--- | :--- | :--- |
| `metallic_chrome` | **铬合金镜面电镀** | `metallic_chrome.jpg` | 裁剪一块大弧面装甲特写，展示真空镀铬超高镜面反射与锐利灯带倒影 |
| `metallic_candy` | **糖果透明叠喷** | `metallic_candy.jpg` | 裁剪一片曲线装甲特写，展示黑底亮银＋透明色多层罩染的深邃宝石光泽 |
| `metallic_pearl` | **珍珠/云母偏光** | `metallic_pearl.jpg` | 裁剪浅白/浅灰弧面装甲特写，展示柔和细闪珍珠云母丝绸偏光 |
| `metallic_color` | **常规彩色金属漆** | `metallic_color.jpg` | 裁剪实色金属漆（如金属蓝/钛灰）装甲局部特写，展示均匀铝粉金属粒子质感 |

---

## 二、 多选叠加规则 & 「整机 vs 局部装甲特写」选图诀窍

> ⚠️ Seedream 多图参考的原理是「从图 1 锁造型轮廓，从图 2 / 图 3 吸取表面漆面纹理、明暗规律与材质光学反射」。参考图选得好，比堆 200 字提示词更管用！

### 1. 多选与参考图数量控制
- **「战损旧化涂装」支持多选叠加**：勾选多项时，文字提示词全部以积木块叠加，同时后端最多自动附加 **前 2 张** 已上传的局部特写参考图作为「图 2 / 图 3」，既能精准叠 Buff 又防止多图输入成本暴涨。
- **「金属/珍珠/电镀特效涂装」保持单选**：电镀铬、糖果漆、珍珠偏光属于互斥的外甲主漆面材质。

### 2. 「整机棚拍照」vs「局部装甲特写截图」怎么选？
1. **4 个独立主技法（`clean_rg` / `max_shadow` / `anime_cel` / `primer_grey`）→ 选紧凑全身/半身棚拍照**：
   - 需要 AI 理解整机大面光影分布、阴影重度与粗黑轮廓线，建议单机占画面 60%+ 且零水印色卡；`primer_grey` 务必找全素灰 #1000 灰模（无红眼/透明件/金属件）。
2. **9 个细分工艺子槽位（战损 5 项 + 金属珍珠电镀 4 项）→ 强烈推荐只放「局部装甲/盾牌高清特写截图」**：
   - 只截取一块肩甲、盾牌或小腿表面，画面中**不要出现完整机体天线或整机轮廓**，让**掉漆颗粒、洗漆油痕、干扫银边、镜面灯带反射或珍珠细闪占满画面 80% 以上（1:1 或 4:3）**，底色优先中性色。这样 Seedream 只吸取纯材质肌理而不会串入别人的机体造型！
3. **文件规范**：无水印、无悬浮色卡方块，推荐 **JPG / WebP / PNG**，长边 `1024px ~ 1280px`，单张 `150KB ~ 350KB`（压小方便 R2 秒传）。
4. **免改代码扩展**：直接打开同目录 [`presets.json`](./presets.json) 编辑 `subStyles` 或 `"subStyleSelection": "multiple" | "single"` 即可。

---

## 三、 本地存放 + 私有 Cloudflare R2 同步步骤（全程 2 分钟）

1. **首次开通 R2 绑定（只需做 1 次）**：
   - 登录 Cloudflare Dashboard → **R2 Object Storage** → 点击 **Create bucket**，名称填 **`gk-mixer-style-refs`**（保持私有，**不要**打开 Public Development URL / 自定义域名）；
   - 打开 **Workers & Pages** → 选中 **`gkcolor-mixer`** → **Settings** → **Bindings**（或 Functions）→ 添加 **R2 bucket binding**：
     - Variable name 填：**`STYLE_REFS_R2`**
     - R2 bucket 选：**`gk-mixer-style-refs`**
   - 保存后点一次部署（或下次推代码自动生效）。
2. **平时放图与热更新流程**：
   - 把按上表重命名好的 `.jpg/.png/.webp` 参考图直接放到本目录 `GK-Mixer-miniwebtools-main/public/ai-style-refs/`（本地 `npm run dev` 会直接加载）；
   - 这些图片已被 `.gitignore` 屏蔽，**永远不会写进 Git 提交或推送到 GitHub**；
   - 运行一条命令一键推送到私有 R2：
     ```bash
     cd GK-Mixer-miniwebtools-main && npm run r2:sync-refs
     ```
   - 也可以直接在 Cloudflare R2 网页后台把新图拖进去覆盖同名文件，**秒级热更新**，无需重新推代码或构建前端。
