# AI Paint Studio 风格参考样板图存放说明

将你拍摄或精选的高质量模型涂装作品放进本目录（`public/ai-style-refs/`），**页面无需改代码**即可自动加载显示在「风格样板参考」预览框中，并在开启「多图参考学习笔触」时作为 Seedream 5.0 Pro 多图参考图随主图一并发送给 AI 学习漆面与光影质感。

## 文件名映射（对应 6 种涂装技法预设）

| 预设 ID | 涂装技法 | 文件路径 | 建议参考图风格 |
| :--- | :--- | :--- | :--- |
| `clean_rg` | 平喷直喷 | `public/ai-style-refs/clean_rg.jpg` | 浅灰无影棚下的干净官图级平喷分色成品 |
| `max_shadow` | 阴影喷涂 | `public/ai-style-refs/max_shadow.jpg` | 暗棚聚光下的 MAX 阴影渐变/高光提亮重涂成品 |
| `anime_cel` | 漫画涂装 | `public/ai-style-refs/anime_cel.jpg` | 硬边三层明暗+粗黑轮廓勾线的二次元破次元作品 |
| `heavy_weathering` | 战损旧化 | `public/ai-style-refs/heavy_weathering.jpg` | 海绵掉漆/流锈/烟熏泥垢写实旧化战损成品 |
| `candy_metallic` | 电镀糖果 | `public/ai-style-refs/candy_metallic.jpg` | 高反光镜面金属/糖果红蓝/钛金骨架成品 |
| `gk_resin_studio` | GK 精涂 | `public/ai-style-refs/gk_resin_studio.jpg` | GK 树脂雕像或机甲重改件的博物馆级精美成品照 |

> 注意：
> 1. 建议尺寸 1024px ~ 1600px 宽，JPG 格式（单张建议 < 800KB）。
> 2. 图内请使用**纯净摄影成品图**，切勿包含色卡文字标签或UI边框，以确保 AI 生成结果干净无杂物。
> 3. 若某个槽位暂未放置图片，前端会自动隐藏失效图并提示用户可自行上传参考图，且完全依靠精调工序提示词出图，不会报错。
