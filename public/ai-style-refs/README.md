# AI Paint Studio 风格参考样板图与预设清单配置说明

将你拍摄或精选的高质量模型涂装作品放进本目录（`GK-Mixer-miniwebtools-main/public/ai-style-refs/`），并在同目录的 `presets.json` 中声明对应映射，**无需修改任何前端/后端代码**：
- 网页端会优先读取 `/ai-style-refs/presets.json` 动态渲染「01 涂装技法」选项，并自动检测该目录中的图片是否存在；
- 当用户未手动上传参考图且开启「多图参考学习笔触」时，**后端（Cloudflare Pages Functions / Vite Dev Proxy）会在服务端直接读取对应图片作为图 2**，随用户的模型原图与「积木式工序提示词」一并发往 Seedream 5.5 / 5.0 Pro；
- 如果某个图片文件尚未放入本目录，后端会自动安全跳过该图、并自动剔除「图 2 参考指引」提示词积木块，仅用纯净文字积木生图，绝不报错。

---

## 1. 默认 6 个风格样板图放置路径

| 预设 ID | 涂装技法 | 图片放置路径 | 默认联动工序（可在页面上手动覆盖） |
| :--- | :--- | :--- | :--- |
| `clean_rg` | 平喷直喷 | `public/ai-style-refs/clean_rg.jpg` | 半消光 · 精密渗线 · 纯白棚 · 双侧柔光 |
| `max_shadow` | MAX 阴影喷涂 | `public/ai-style-refs/max_shadow.jpg` | 纯哑光 · 渗线/水贴/金属骨架 · 深灰暗棚 · 顶部神光 |
| `anime_cel` | 漫画涂装 | `public/ai-style-refs/anime_cel.jpg` | 纯哑光 · 精密渗线 · 切割垫桌面 · 双侧柔光 |
| `heavy_weathering` | 战损旧化 | `public/ai-style-refs/heavy_weathering.jpg` | 纯哑光 · 渗线/水贴/金属骨架 · 深灰暗棚 · 侧逆光 |
| `candy_metallic` | 电镀糖果 | `public/ai-style-refs/candy_metallic.jpg` | 镜面光油 · 金属骨架/发光 · 深灰暗棚 · 侧逆光 |
| `gk_resin_studio` | GK 灰模精涂 | `public/ai-style-refs/gk_resin_studio.jpg` | 半消光 · 渗线/金属骨架 · 纯白棚 · 顶部神光 |

> 注意：
> - 支持 `.jpg` / `.jpeg` / `.png` / `.webp` 格式；建议宽 1024px ~ 1600px、单张 < 1MB。
> - 图内请使用**纯净摄影成品图**，切勿包含悬浮色卡方块、价签或水印，以确保 AI 输出图干净无杂物。

---

## 2. 如何免改代码增减或修改预设风格（编辑 `presets.json`）

打开同目录下的 [`presets.json`](./presets.json)：

1. **更换图片文件名或格式**（比如换成了 `.png`）：把对应项里的 `"sampleImage": "clean_rg.jpg"` 改为 `"clean_rg.png"` 即可。
2. **临时下架某一个预设**：把 `"enabled": true` 改为 `"enabled": false` 即可（无需删掉配置）。
3. **新增第 7 个 / 更多预设**：
   - 把新参考图放进本目录（如 `public/ai-style-refs/titanium_finish.jpg`）；
   - 在 `presets.json` 数组末尾追加一个 JSON 对象（注意 `id` 仅用字母/数字/下划线，`name` 建议 ≤ 7 个字以免按钮截断）：
   ```json
   {
     "id": "titanium_finish",
     "name": "钛合金白",
     "badge": "金属质感",
     "sampleImage": "titanium_finish.jpg",
     "defaultFinish": "metallic_pearl",
     "defaultCrafts": ["panel_lining", "metallic_frame"],
     "defaultBg": "dark_studio",
     "defaultLighting": "rim_dramatic",
     "prompt": "钛合金白特殊涂层涂装效果，保留洁净白色金属颗粒反光与边缘折角深色金属过渡。严格保持原图模型结构、比例与视角100%不变。",
     "enabled": true
   }
   ```
   - 可用的预设字段可选值：
     - `defaultFinish`：`matte` | `semi_gloss` | `gloss` | `metallic_pearl`
     - `defaultCrafts`：`panel_lining` | `decals` | `metallic_frame` | `led_glow`（数组可多选）
     - `defaultBg`：`white_studio` | `dark_studio` | `cutting_mat` | `hangar_bay` | `transparent`
     - `defaultLighting`：`soft_dual` | `top_key` | `rim_dramatic`
