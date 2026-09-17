import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

src_icon_path = '/Users/krooshuang/code/ios-GK-mixer/GK-Mixer/GK-Mixer/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
out_dir = '/Users/krooshuang/code/ios-GK-mixer/IAP_Promotional_Images'
os.makedirs(out_dir, exist_ok=True)

base_icon = Image.open(src_icon_path).convert('RGB')
W, H = base_icon.size

# 胶囊黄金比例
pw, ph = 380, 136
# 摆放位置：右下角，右边距 84，下边距 96（完美避开 Apple 225px 圆角裁切）
px = W - pw - 86
py = H - ph - 96
radius = ph // 2 # 68px

font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = ImageFont.truetype(font_path, 80)

def render_advanced_liquid_glass(variant_name, theme="crystal", text_mode="dark_inset"):
    canvas = base_icon.copy()

    # --- 1. 环境与悬浮投影 (Multi-layered Occlusion Shadow) ---
    # 软环境光大阴影
    ambient_shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    asd = ImageDraw.Draw(ambient_shadow)
    asd.rounded_rectangle([px - 4, py + 16, px + pw + 4, py + ph + 24], radius=radius + 4, fill=(0, 0, 0, 130))
    ambient_shadow = ambient_shadow.filter(ImageFilter.GaussianBlur(24))

    # 方向定向阴影 (光源自左上方 135度)
    dir_shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dsd = ImageDraw.Draw(dir_shadow)
    dsd.rounded_rectangle([px + 2, py + 10, px + pw - 2, py + ph + 12], radius=radius, fill=(0, 0, 0, 170))
    dir_shadow = dir_shadow.filter(ImageFilter.GaussianBlur(10))

    # 紧致接触阴影 (体现物理实体厚度)
    contact_shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    csd = ImageDraw.Draw(contact_shadow)
    csd.rounded_rectangle([px, py + 3, px + pw, py + ph + 3], radius=radius, fill=(0, 0, 0, 190))
    contact_shadow = contact_shadow.filter(ImageFilter.GaussianBlur(4))

    # 底部透光聚光斑 (Caustic Lens Glow)
    caustic = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(caustic)
    cd.rounded_rectangle([px + 45, py + ph - 6, px + pw - 45, py + ph + 22], radius=20, fill=(255, 255, 255, 85))
    caustic = caustic.filter(ImageFilter.GaussianBlur(14))

    # 贴到主画布
    canvas.paste(ambient_shadow, (0, 0), ambient_shadow)
    canvas.paste(dir_shadow, (0, 0), dir_shadow)
    canvas.paste(caustic, (0, 0), caustic)
    canvas.paste(contact_shadow, (0, 0), contact_shadow)

    # --- 2. 玻璃透镜折射与微模糊 (Lens Refraction & Frost) ---
    crop = base_icon.crop((px - 15, py - 15, px + pw + 15, py + ph + 15))
    cw, ch = crop.size
    # 放大 1.05 倍模拟凸透镜
    lens_mag = crop.resize((int(cw * 1.05), int(ch * 1.05)), Image.Resampling.LANCZOS)
    mcx, mcy = lens_mag.size[0] // 2, lens_mag.size[1] // 2
    lens = lens_mag.crop((mcx - pw//2, mcy - ph//2, mcx + pw//2, mcy + ph//2))

    # 轻度毛玻璃模糊 (保留足够通透感)
    lens = lens.filter(ImageFilter.GaussianBlur(7))
    lens = ImageEnhance.Brightness(lens).enhance(1.18)
    lens = ImageEnhance.Contrast(lens).enhance(1.10)
    glass_core = lens.convert('RGBA')

    # --- 3. 玻璃材质通透膜与渐变 (Glass Substrate) ---
    substrate = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    sd = ImageDraw.Draw(substrate)
    if theme == "crystal":
        # 冰晶纯白流体
        for y in range(ph):
            t = y / ph
            # 顶部微透白 80 -> 中部通透 25 -> 底部微泛光 50
            alpha = int(95 * (1 - t)**1.6 + 45 * (t**1.4))
            sd.line([(0, y), (pw, y)], fill=(255, 255, 255, alpha))
    elif theme == "amber_gold":
        # 琥珀香槟金微光
        for y in range(ph):
            t = y / ph
            alpha = int(120 * (1 - t)**1.5 + 50 * t)
            sd.line([(0, y), (pw, y)], fill=(255, 215, 120, alpha))
    else: # ice_frost
        for y in range(ph):
            t = y / ph
            alpha = int(140 * (1 - t)**1.4 + 35 * t)
            sd.line([(240, 248, 255, alpha)])
            sd.line([(0, y), (pw, y)], fill=(220, 235, 255, alpha))

    glass_core = Image.alpha_composite(glass_core, substrate)

    # --- 4. 流体液态弧形高光 (Fluid Liquid Surface Specular) ---
    # 上半部分饱满的水滴高光
    top_spec = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    td = ImageDraw.Draw(top_spec)
    gh = int(ph * 0.50)
    for y in range(gh):
        t = y / gh
        # 顶部 210 -> 底部 0
        a = int(210 * ((1 - t)**1.3))
        td.line([(radius // 2, y + 2), (pw - radius // 2, y + 2)], fill=(255, 255, 255, a))

    # 水滴圆润弧形反光截面
    t_mask = Image.new('L', (pw, ph), 0)
    ImageDraw.Draw(t_mask).rounded_rectangle([3, 3, pw - 4, gh + 10], radius=radius - 3, fill=255)
    arc_cut = Image.new('L', (pw, ph), 255)
    ImageDraw.Draw(arc_cut).chord([-pw * 0.15, gh - 12, pw * 1.15, gh + 60], start=0, end=360, fill=0)
    t_mask.paste(arc_cut, (0, 0), Image.eval(arc_cut, lambda v: 255 - v))
    top_spec = Image.composite(top_spec, Image.new('RGBA', (pw, ph), (0, 0, 0, 0)), t_mask)
    top_spec = top_spec.filter(ImageFilter.GaussianBlur(1.6))
    glass_core = Image.alpha_composite(glass_core, top_spec)

    # --- 5. 双重菲涅尔倒角折射与晶体边缘 (Fresnel Rim Highlight) ---
    rim = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    # 最外层极细反光光刃 (Top-Left 全反射)
    rd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=radius, outline=(255, 255, 255, 230), width=2)
    # 顶部强化白线
    rd.line([(radius, 1), (pw - radius, 1)], fill=(255, 255, 255, 255), width=2)
    # 内部 1px 玻璃厚度倒角线
    rd.rounded_rectangle([2, 2, pw - 3, ph - 3], radius=radius - 2, outline=(255, 255, 255, 95), width=1)
    rim = rim.filter(ImageFilter.GaussianBlur(0.8))
    glass_core = Image.alpha_composite(glass_core, rim)

    # --- 6. PRO 文字排版与微晶雕刻效果 ---
    letters = "PRO"
    dummy = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    letter_widths = [dummy.textbbox((0, 0), ch, font=font)[2] for ch in letters]
    spacing = 16
    total_w = sum(letter_widths) + spacing * (len(letters) - 1)
    start_x = (pw - total_w) // 2
    cy = ph // 2 - 4 # 垂直居中稍微上提，视觉最舒适

    if text_mode == "dark_inset":
        # 黑晶钛金微雕（深色文字，在白毛背景上对比度最高）
        # 底部 1.5px 亮白色下凹高光槽 (体现内凹雕刻在玻璃中的质感)
        notch = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        nd = ImageDraw.Draw(notch)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            nd.text((lx, cy + 2), ch, fill=(255, 255, 255, 220), font=font)
        notch = notch.filter(ImageFilter.GaussianBlur(1.0))
        glass_core = Image.alpha_composite(glass_core, notch)

        # 文字主体（高级深空灰炭黑）
        tf = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tfd = ImageDraw.Draw(tf)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tfd.text((lx, cy), ch, fill=(28, 32, 42, 245), font=font)
        glass_core = Image.alpha_composite(glass_core, tf)

    elif text_mode == "gold_inset":
        # 琥珀金雕文字
        # 阴影
        tf_s = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tfsd = ImageDraw.Draw(tf_s)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tfsd.text((lx, cy + 3), ch, fill=(60, 40, 10, 180), font=font)
        tf_s = tf_s.filter(ImageFilter.GaussianBlur(2.5))
        glass_core = Image.alpha_composite(glass_core, tf_s)

        tf = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tfd = ImageDraw.Draw(tf)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tfd.text((lx, cy), ch, fill=(245, 190, 50, 255), font=font)
        glass_core = Image.alpha_composite(glass_core, tf)

    else: # white_glow
        # 纯白晶体浮雕 + 强暗部投影确保可读性
        tf_s = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tfsd = ImageDraw.Draw(tf_s)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tfsd.text((lx, cy + 4), ch, fill=(0, 0, 0, 220), font=font)
        tf_s = tf_s.filter(ImageFilter.GaussianBlur(4.0))
        glass_core = Image.alpha_composite(glass_core, tf_s)

        tf = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tfd = ImageDraw.Draw(tf)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tfd.text((lx, cy), ch, fill=(255, 255, 255, 255), font=font)
        glass_core = Image.alpha_composite(glass_core, tf)

    # 药丸遮罩贴入
    pill_mask = Image.new('L', (pw, ph), 0)
    ImageDraw.Draw(pill_mask).rounded_rectangle([0, 0, pw, ph], radius=radius, fill=255)
    canvas.paste(glass_core, (px, py), pill_mask)

    out_file = os.path.join(out_dir, variant_name)
    canvas.save(out_file, 'PNG')
    print(f"Saved {variant_name}")

# 生成三种风格
render_advanced_liquid_glass('GK_Mixer_IAP_LiquidGlass_Crystal.png', theme="crystal", text_mode="dark_inset")
render_advanced_liquid_glass('GK_Mixer_IAP_LiquidGlass_AmberGold.png', theme="amber_gold", text_mode="gold_inset")
render_advanced_liquid_glass('GK_Mixer_IAP_LiquidGlass_IceWhite.png', theme="crystal", text_mode="white_glow")

# 同时更新默认推广图
render_advanced_liquid_glass('GK_Mixer_IAP_LiquidGlass_1024x1024.png', theme="crystal", text_mode="dark_inset")
print("All 3 styles generated successfully!")
