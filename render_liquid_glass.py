import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

src_icon_path = '/Users/krooshuang/code/ios-GK-mixer/GK-Mixer/GK-Mixer/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
out_dir = '/Users/krooshuang/code/ios-GK-mixer/IAP_Promotional_Images'
os.makedirs(out_dir, exist_ok=True)

base_icon = Image.open(src_icon_path).convert('RGB')
W, H = base_icon.size

# 胶囊尺寸与位置
pw, ph = 380, 144
px = W - pw - 100
py = H - ph - 110
radius = ph // 2 # 完全药丸形状 (Pill shape, 半径 72)

def create_pill_mask(w, h, r):
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w, h], radius=r, fill=255)
    return m

pill_mask = create_pill_mask(pw, ph, radius)

# --- 1. 底层阴影与透光 (Caustics + Drop Shadow) ---
shadow_canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow_canvas)
# 主软投影
sd.rounded_rectangle([px, py + 14, px + pw, py + ph + 14], radius=radius, fill=(0, 0, 0, 160))
shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(22))

# 贴近物体的紧致接触阴影
contact_shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
csd = ImageDraw.Draw(contact_shadow)
csd.rounded_rectangle([px, py + 6, px + pw, py + ph + 6], radius=radius, fill=(0, 0, 0, 120))
contact_shadow = contact_shadow.filter(ImageFilter.GaussianBlur(8))

# 焦散透光光晕 (玻璃聚光在下方形成的微弱亮斑)
caustic = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(caustic)
cd.rounded_rectangle([px + 40, py + ph - 10, px + pw - 40, py + ph + 24], radius=20, fill=(255, 255, 255, 45))
caustic = caustic.filter(ImageFilter.GaussianBlur(14))

# 合并到底图上
canvas = base_icon.copy()
canvas.paste(contact_shadow, (0, 0), contact_shadow)
canvas.paste(shadow_canvas, (0, 0), shadow_canvas)
canvas.paste(caustic, (0, 0), caustic)

# --- 2. 玻璃背板模糊与透光折射 (Refracted & Blurred Glass Backing) ---
# 截取胶囊底下的原图
backdrop_crop = base_icon.crop((px, py, px + pw, py + ph))
# 高斯模糊模拟磨砂毛玻璃
blurred_crop = backdrop_crop.filter(ImageFilter.GaussianBlur(16))
# 提高亮度和微调对比度 (玻璃介质透光增亮)
enhancer = ImageEnhance.Brightness(blurred_crop)
blurred_crop = enhancer.enhance(1.22)
contrast_enhancer = ImageEnhance.Contrast(blurred_crop)
blurred_crop = contrast_enhancer.enhance(1.08)

# 叠加上一层微妙的玻璃基质渐变 (顶部微透白，中间通透，底部微暗)
glass_body = blurred_crop.convert('RGBA')
tint = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
td = ImageDraw.Draw(tint)
for y in range(ph):
    t = y / ph
    # 顶部轻白雾 (255, 255, 255, 70) -> 中间通透 (255, 255, 255, 25) -> 底部环境光 (200, 220, 255, 45)
    alpha = int(75 * (1 - t)**1.5 + 40 * t)
    td.line([(0, y), (pw, y)], fill=(255, 255, 255, alpha))

glass_body = Image.alpha_composite(glass_body, tint)

# --- 3. 液态圆润高光 (Liquid Gloss Top Reflection) ---
# 顶部 48% 高度的水滴/液态圆弧反光
gloss = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
gd = ImageDraw.Draw(gloss)
gloss_h = int(ph * 0.52)
for y in range(gloss_h):
    t = y / gloss_h
    # 顶部极为透亮，平滑衰减
    alpha = int(140 * (1 - t)**1.2)
    gd.line([(radius // 3, y + 4), (pw - radius // 3, y + 4)], fill=(255, 255, 255, alpha))

# 给液态高光加一个内缩椭圆，形成饱满弧度
gloss_mask = Image.new('L', (pw, ph), 0)
gmd = ImageDraw.Draw(gloss_mask)
gmd.rounded_rectangle([3, 3, pw - 4, gloss_h + 8], radius=radius - 2, fill=255)
# 挖去下半弧线，形成液态弯曲截面
arc_cut = Image.new('L', (pw, ph), 255)
acd = ImageDraw.Draw(arc_cut)
acd.chord([-pw * 0.2, gloss_h - 18, pw * 1.2, gloss_h + 60], start=0, end=360, fill=0)
gloss_mask.paste(arc_cut, (0, 0), Image.eval(arc_cut, lambda v: 255 - v))

gloss = Image.composite(gloss, Image.new('RGBA', (pw, ph), (0, 0, 0, 0)), gloss_mask)
gloss = gloss.filter(ImageFilter.GaussianBlur(1.8))
glass_body = Image.alpha_composite(glass_body, gloss)

# --- 4. 菲涅尔双层边缘光 (Fresnel Rims & Inner Bevel) ---
# 顶部/左上高亮光边，右下微弱反光
rim = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
rd = ImageDraw.Draw(rim)
# 外部 2px 亮边
for i in range(2):
    rd.rounded_rectangle([i, i, pw - 1 - i, ph - 1 - i], radius=radius - i, outline=(255, 255, 255, 160 - i * 40), width=1)

# 内发光高光 (Inner Glow)
inner_glow = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
igd = ImageDraw.Draw(inner_glow)
igd.rounded_rectangle([2, 2, pw - 3, ph - 3], radius=radius - 2, outline=(255, 255, 255, 210), width=2)
igd.rounded_rectangle([4, 4, pw - 5, ph - 5], radius=radius - 4, outline=(255, 255, 255, 80), width=1)
inner_glow = inner_glow.filter(ImageFilter.GaussianBlur(2.5))
glass_body = Image.alpha_composite(glass_body, inner_glow)
glass_body = Image.alpha_composite(glass_body, rim)

# --- 5. 文字渲染 (PRO 晶莹高质感立体字) ---
font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = ImageFont.truetype(font_path, 82)

# 文字层
txt_layer = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
td = ImageDraw.Draw(txt_layer)

cx = pw // 2
cy = ph // 2 - 2

# 文字软阴影 (增强在玻璃内的悬浮立体感)
txt_shadow = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
tsd = ImageDraw.Draw(txt_shadow)
tsd.text((cx, cy + 4), 'PRO', fill=(0, 0, 0, 160), font=font, anchor='mm')
txt_shadow = txt_shadow.filter(ImageFilter.GaussianBlur(4))
glass_body = Image.alpha_composite(glass_body, txt_shadow)

# 文字接触微阴影
tsd2 = ImageDraw.Draw(glass_body)
tsd2.text((cx, cy + 2), 'PRO', fill=(15, 25, 35, 120), font=font, anchor='mm')

# 文字主体 (带极细微垂直渐变的纯净白光)
txt_front = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
tfd = ImageDraw.Draw(txt_front)
tfd.text((cx, cy), 'PRO', fill=(255, 255, 255, 255), font=font, anchor='mm')
# 文字顶端高光光晕
txt_glow = txt_front.filter(ImageFilter.GaussianBlur(1.5))
glass_body = Image.alpha_composite(glass_body, txt_glow)
glass_body = Image.alpha_composite(glass_body, txt_front)

# 把玻璃主体贴到主画布上
canvas.paste(glass_body, (px, py), pill_mask)

# 保存最终效果图
final_path = os.path.join(out_dir, 'GK_Mixer_IAP_LiquidGlass_1024x1024.png')
canvas.save(final_path, 'PNG')
print(f'Liquid Glass Promotional Image generated at: {final_path}')
