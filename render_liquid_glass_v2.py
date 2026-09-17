import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

src_icon_path = '/Users/krooshuang/code/ios-GK-mixer/GK-Mixer/GK-Mixer/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
out_dir = '/Users/krooshuang/code/ios-GK-mixer/IAP_Promotional_Images'
os.makedirs(out_dir, exist_ok=True)

base_icon = Image.open(src_icon_path).convert('RGB')
W, H = base_icon.size

def render_liquid_glass(style="crystal", text_color="dark"):
    """
    style: 'crystal' (纯澈高透水晶流体) or 'gold_amber' (流体琥珀金玻)
    text_color: 'dark' (深邃黑钛水晶内嵌, 对比度极高) or 'white_glow' (高亮冰晶浮雕)
    """
    canvas = base_icon.copy()
    pw, ph = 390, 146
    # 放置在右下角偏内，与猫咪爪子和漆瓶有完美的层叠互动
    px = W - pw - 92
    py = H - ph - 96
    radius = ph // 2

    # 1. 模拟凸透镜折射效果 (Magnification / Bulge)
    # 取略大一点的区域并放大裁切，模拟厚玻璃折射
    pad = 30
    crop_area = (px - pad, py - pad, px + pw + pad, py + ph + pad)
    bg_sub = base_icon.crop(crop_area)
    # 轻微放大 1.06 倍
    sub_w, sub_h = bg_sub.size
    mag_w, mag_h = int(sub_w * 1.06), int(sub_h * 1.06)
    mag_sub = bg_sub.resize((mag_w, mag_h), Image.Resampling.LANCZOS)
    # 居中切回
    cx_m, cy_m = mag_w // 2, mag_h // 2
    lens_refract = mag_sub.crop((cx_m - pw//2, cy_m - ph//2, cx_m + pw//2 + (pw%2), cy_m + ph//2 + (ph%2)))

    # 磨砂扩散 (微模糊，保留一定清晰度体现 Liquid Glass 的通透感)
    lens_blur = lens_refract.filter(ImageFilter.GaussianBlur(8))
    # 提升通透度和对比度
    lens_blur = ImageEnhance.Brightness(lens_blur).enhance(1.15)
    lens_blur = ImageEnhance.Contrast(lens_blur).enhance(1.12)
    glass_body = lens_blur.convert('RGBA')

    # 2. 真实多层立体投影 (Drop Shadows & Ambient Occlusion)
    shadow_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_img)
    # 远距离柔和漫反射环境阴影
    sdraw.rounded_rectangle([px, py + 18, px + pw, py + ph + 18], radius=radius, fill=(0, 0, 0, 140))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(26))
    # 中距离主体阴影
    shadow_mid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sm_draw = ImageDraw.Draw(shadow_mid)
    sm_draw.rounded_rectangle([px, py + 8, px + pw, py + ph + 8], radius=radius, fill=(0, 0, 0, 160))
    shadow_mid = shadow_mid.filter(ImageFilter.GaussianBlur(10))
    # 近距离接触实影
    shadow_contact = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sc_draw = ImageDraw.Draw(shadow_contact)
    sc_draw.rounded_rectangle([px, py + 3, px + pw, py + ph + 3], radius=radius, fill=(0, 0, 0, 180))
    shadow_contact = shadow_contact.filter(ImageFilter.GaussianBlur(4))

    # 底部透镜聚光折射焦散 (Caustic Reflection)
    caustic = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(caustic)
    cdraw.rounded_rectangle([px + 50, py + ph - 8, px + pw - 50, py + ph + 28], radius=24, fill=(255, 255, 255, 75))
    caustic = caustic.filter(ImageFilter.GaussianBlur(16))

    canvas.paste(shadow_img, (0, 0), shadow_img)
    canvas.paste(shadow_mid, (0, 0), shadow_mid)
    canvas.paste(caustic, (0, 0), caustic)
    canvas.paste(shadow_contact, (0, 0), shadow_contact)

    # 3. 玻璃材质表面着色与菲涅尔色散层 (Glass Sheen Layer)
    sheen = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    sh_draw = ImageDraw.Draw(sheen)
    if style == "crystal":
        for y in range(ph):
            t = y / ph
            # 水晶透白: 顶部 110 -> 中间 20 -> 底部 60 (带一点点天光冷调)
            alpha = int(120 * (1 - t)**1.8 + 50 * (t**1.5))
            sh_draw.line([(0, y), (pw, y)], fill=(245, 250, 255, alpha))
    else: # gold_amber 琥珀微金
        for y in range(ph):
            t = y / ph
            alpha = int(140 * (1 - t)**1.5 + 60 * t)
            sh_draw.line([(0, y), (pw, y)], fill=(255, 225, 150, alpha))
    glass_body = Image.alpha_composite(glass_body, sheen)

    # 4. 双曲率液态流线高光 (Double-Wave Liquid Highlights)
    # 主高光弧顶 (Top Gloss Capsule)
    top_gloss = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    tg_draw = ImageDraw.Draw(top_gloss)
    gh = int(ph * 0.50)
    for y in range(gh):
        t = y / gh
        alpha = int(210 * (1 - t)**1.3)
        tg_draw.line([(radius//2, y + 4), (pw - radius//2, y + 4)], fill=(255, 255, 255, alpha))

    # 挖出水滴饱满弧形遮罩
    tmask = Image.new('L', (pw, ph), 0)
    tmd = ImageDraw.Draw(tmask)
    tmd.rounded_rectangle([4, 4, pw - 5, gh + 14], radius=radius - 4, fill=255)
    arc_cut = Image.new('L', (pw, ph), 255)
    ac_draw = ImageDraw.Draw(arc_cut)
    ac_draw.chord([-pw * 0.1, gh - 14, pw * 1.1, gh + 70], start=0, end=360, fill=0)
    tmask.paste(arc_cut, (0, 0), Image.eval(arc_cut, lambda v: 255 - v))
    top_gloss = Image.composite(top_gloss, Image.new('RGBA', (pw, ph), (0, 0, 0, 0)), tmask)
    top_gloss = top_gloss.filter(ImageFilter.GaussianBlur(1.5))
    glass_body = Image.alpha_composite(glass_body, top_gloss)

    # 5. 菲涅尔多层折射边缘光与棱镜色散 (Prismatic Bevel Rim)
    rim = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    # 最外层极细高光亮刃 (1px)
    rd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=radius, outline=(255, 255, 255, 230), width=2)
    # 顶部强化白光线
    rd.line([(radius, 1), (pw - radius, 1)], fill=(255, 255, 255, 255), width=2)
    # 内边缘 1px 细环 (体现玻璃壁厚 Wall Thickness)
    rd.rounded_rectangle([2, 2, pw - 3, ph - 3], radius=radius - 2, outline=(255, 255, 255, 110), width=1)
    rd.rounded_rectangle([4, 4, pw - 5, ph - 5], radius=radius - 4, outline=(255, 255, 255, 60), width=1)
    rim = rim.filter(ImageFilter.GaussianBlur(0.6))
    glass_body = Image.alpha_composite(glass_body, rim)

    # 6. 文字排版与高质感立体效果 (PRO Typography)
    font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font = ImageFont.truetype(font_path, 86)
    cx, cy = pw // 2, ph // 2 - 2

    # 计算字间距：手动绘制字母以获得优雅的呼吸感
    letters = "PRO"
    # 获取每个字母大小
    dummy = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    letter_widths = [dummy.textbbox((0, 0), ch, font=font)[2] for ch in letters]
    spacing = 18 # 增加字间距
    total_w = sum(letter_widths) + spacing * (len(letters) - 1)
    start_x = cx - total_w // 2

    # 文字阴影层
    txt_layer = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    t_draw = ImageDraw.Draw(txt_layer)

    if text_color == "dark":
        # 黑晶钛金内雕 (深色高端磨砂内嵌，对比度绝佳)
        # 1. 浅色下发光 (模拟凹槽边缘高光)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            t_draw.text((lx, cy + 2), ch, fill=(255, 255, 255, 220), font=font)
        txt_layer = txt_layer.filter(ImageFilter.GaussianBlur(1.0))
        glass_body = Image.alpha_composite(glass_body, txt_layer)

        # 2. 深色主体 (深灰带蓝黑渐变)
        txt_front = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tf_draw = ImageDraw.Draw(txt_front)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tf_draw.text((lx, cy - 1), ch, fill=(24, 28, 38, 240), font=font)
        glass_body = Image.alpha_composite(glass_body, txt_front)

    else:
        # 白晶高光浮雕
        # 1. 深色实影
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            t_draw.text((lx, cy + 5), ch, fill=(0, 0, 0, 180), font=font)
        txt_layer = txt_layer.filter(ImageFilter.GaussianBlur(3.5))
        glass_body = Image.alpha_composite(glass_body, txt_layer)

        # 2. 白色发光主体
        txt_front = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        tf_draw = ImageDraw.Draw(txt_front)
        for i, ch in enumerate(letters):
            lx = start_x + sum(letter_widths[:i]) + spacing * i
            tf_draw.text((lx, cy), ch, fill=(255, 255, 255, 255), font=font)
        glass_body = Image.alpha_composite(glass_body, txt_front)

    # 裁切出药丸形状
    pill_mask = Image.new('L', (pw, ph), 0)
    ImageDraw.Draw(pill_mask).rounded_rectangle([0, 0, pw, ph], radius=radius, fill=255)

    canvas.paste(glass_body, (px, py), pill_mask)
    return canvas

# 生成两款不同视觉风格的 Liquid Glass
img_dark = render_liquid_glass(style="crystal", text_color="dark")
path_dark = os.path.join(out_dir, 'GK_Mixer_IAP_LiquidGlass_DarkText_1024x1024.png')
img_dark.save(path_dark, 'PNG')

img_white = render_liquid_glass(style="crystal", text_color="white_glow")
path_white = os.path.join(out_dir, 'GK_Mixer_IAP_LiquidGlass_WhiteGlow_1024x1024.png')
img_white.save(path_white, 'PNG')

# 顺便更新默认的 GK_Mixer_IAP_LiquidGlass_1024x1024.png 为效果最扎实清晰的 DarkText 版
img_dark.save(os.path.join(out_dir, 'GK_Mixer_IAP_LiquidGlass_1024x1024.png'), 'PNG')
print("Rendered both Liquid Glass variations successfully!")
