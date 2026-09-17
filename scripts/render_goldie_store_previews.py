import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

BASE_DIR = "/Users/krooshuang/code/ios-GK-mixer"
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "goldie-studio/public/screenshots")
OUT_DIR = os.path.join(BASE_DIR, "goldie/out/screenshots/iphone-6.9/zh-CN")
os.makedirs(OUT_DIR, exist_ok=True)

CANVAS_W, CANVAS_H = 1320, 2868

FONT_CN_BOLD = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_EN_BOLD = "/Library/Fonts/SF-Pro.ttf"

def get_fonts(headline_size=92, subhead_size=44):
    try:
        h_font = ImageFont.truetype(FONT_CN_BOLD, headline_size)
        s_font = ImageFont.truetype(FONT_CN_BOLD, subhead_size)
    except Exception:
        h_font = ImageFont.load_default()
        s_font = ImageFont.load_default()
    return h_font, s_font

def create_gradient(w, h, color1, color2, color3=None):
    gradient = Image.new('RGBA', (1, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gradient)
    if color3:
        for y in range(h):
            t = y / (h - 1)
            if t < 0.5:
                sub_t = t * 2
                r = int(color1[0] * (1 - sub_t) + color2[0] * sub_t)
                g = int(color1[1] * (1 - sub_t) + color2[1] * sub_t)
                b = int(color1[2] * (1 - sub_t) + color2[2] * sub_t)
            else:
                sub_t = (t - 0.5) * 2
                r = int(color2[0] * (1 - sub_t) + color3[0] * sub_t)
                g = int(color2[1] * (1 - sub_t) + color3[1] * sub_t)
                b = int(color2[2] * (1 - sub_t) + color3[2] * sub_t)
            gd.point((0, y), fill=(r, g, b, 255))
    else:
        for y in range(h):
            t = y / (h - 1)
            r = int(color1[0] * (1 - t) + color2[0] * t)
            g = int(color1[1] * (1 - t) + color2[1] * t)
            b = int(color1[2] * (1 - t) + color2[2] * t)
            gd.point((0, y), fill=(r, g, b, 255))
    
    return gradient.resize((w, h), Image.Resampling.BILINEAR).convert('RGB')

def create_uikit_framed_phone(screenshot_path, target_screen_w=950, bezel_style="titanium_silver", screen_only=False):
    raw_shot = Image.open(screenshot_path).convert('RGBA')
    raw_w, raw_h = raw_shot.size
    aspect = raw_h / raw_w # ~ 2.1787
    
    screen_w = target_screen_w
    screen_h = int(screen_w * aspect)
    resized_screen = raw_shot.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    
    if screen_only:
        radius = int(screen_w * 0.11)
        mask = Image.new('L', (screen_w, screen_h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen_w, screen_h], radius=radius, fill=255)
        
        output_screen = Image.new('RGBA', (screen_w, screen_h), (0,0,0,0))
        output_screen.paste(resized_screen, (0, 0), mask)
        bd = ImageDraw.Draw(output_screen)
        bd.rounded_rectangle([0, 0, screen_w-1, screen_h-1], radius=radius, outline=(0, 0, 0, 40), width=3)
        return output_screen

    # Apple specifications: ultra-thin 1.15mm border (~34px on 950px screen)
    bezel_thickness = int(screen_w * 0.036) # 34px
    outer_w = screen_w + bezel_thickness * 2
    outer_h = screen_h + bezel_thickness * 2
    outer_radius = int(outer_w * 0.125)
    inner_radius = outer_radius - bezel_thickness

    # Button paddings on outer bounds
    btn_pad = 12
    phone_w = outer_w + btn_pad * 2
    phone_h = outer_h

    if bezel_style == "cosmic_orange":
        rim_colors = ((246, 163, 94), (206, 102, 32), (255, 209, 168))
        btn_color = (206, 102, 32, 255)
    elif bezel_style == "deep_blue":
        rim_colors = ((50, 71, 101), (26, 40, 59), (80, 110, 152))
        btn_color = (36, 53, 77, 255)
    elif bezel_style == "space_black":
        rim_colors = ((56, 58, 67), (26, 27, 32), (79, 82, 93))
        btn_color = (34, 35, 40, 255)
    else: # titanium_silver
        rim_colors = ((240, 242, 245), (196, 200, 208), (255, 255, 255))
        btn_color = (196, 200, 208, 255)

    phone = Image.new('RGBA', (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)

    # 1. Physical Hardware Buttons
    # Left: Action Button
    draw.rounded_rectangle([btn_pad - 6, int(phone_h * 0.16), btn_pad, int(phone_h * 0.16) + 65], radius=3, fill=btn_color)
    # Left: Vol Up
    draw.rounded_rectangle([btn_pad - 6, int(phone_h * 0.22), btn_pad, int(phone_h * 0.22) + 125], radius=3, fill=btn_color)
    # Left: Vol Down
    draw.rounded_rectangle([btn_pad - 6, int(phone_h * 0.30), btn_pad, int(phone_h * 0.30) + 125], radius=3, fill=btn_color)
    # Right: Power / Side Button
    draw.rounded_rectangle([btn_pad + outer_w, int(phone_h * 0.23), btn_pad + outer_w + 6, int(phone_h * 0.23) + 190], radius=3, fill=btn_color)

    # 2. Outer Titanium Body
    ox = btn_pad
    draw.rounded_rectangle([ox, 0, ox + outer_w, outer_h], radius=outer_radius, fill=rim_colors[0] + (255,))
    draw.rounded_rectangle([ox, 0, ox + outer_w - 1, outer_h - 1], radius=outer_radius, outline=rim_colors[2] + (255,), width=2)
    draw.rounded_rectangle([ox + 2, 2, ox + outer_w - 3, outer_h - 3], radius=outer_radius - 2, outline=rim_colors[1] + (255,), width=2)

    # 3. Inner Dark Matrix Gap
    gap = 4
    draw.rounded_rectangle(
        [ox + bezel_thickness - gap, bezel_thickness - gap, ox + outer_w - (bezel_thickness - gap), outer_h - (bezel_thickness - gap)],
        radius=inner_radius + gap,
        fill=(10, 12, 16, 255)
    )

    # 4. Mask and Paste Screen
    screen_mask = Image.new('L', (screen_w, screen_h), 0)
    ImageDraw.Draw(screen_mask).rounded_rectangle([0, 0, screen_w, screen_h], radius=inner_radius, fill=255)
    phone.paste(resized_screen, (ox + bezel_thickness, bezel_thickness), screen_mask)

    # 5. Screen Glass Sheen (Apple Marketing diagonal highlight)
    sheen = Image.new('RGBA', (screen_w, screen_h), (0, 0, 0, 0))
    sh_draw = ImageDraw.Draw(sheen)
    sh_h = int(screen_h * 0.35)
    for y in range(sh_h):
        alpha = int(35 * (1 - y / sh_h))
        sh_draw.line([(0, y), (screen_w, y)], fill=(255, 255, 255, alpha))
    # Alpha-composite the reflection.  `paste(..., screen_mask)` would replace the
    # complete display with the transparent parts of `sheen`, erasing the UI.
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"), screen_mask))
    phone.alpha_composite(sheen, (ox + bezel_thickness, bezel_thickness))

    # 6. Dynamic Island Pill
    di_w = int(screen_w * 0.28)
    di_h = int(di_w * 0.31)
    di_x = ox + (outer_w - di_w) // 2
    di_y = bezel_thickness + int(screen_w * 0.032)
    di_radius = di_h // 2
    draw.rounded_rectangle([di_x, di_y, di_x + di_w, di_y + di_h], radius=di_radius, fill=(0, 0, 0, 255))
    # Camera dot
    cam_size = int(di_h * 0.35)
    cam_x = di_x + di_w - int(di_h * 0.65)
    cam_y = di_y + (di_h - cam_size) // 2
    draw.ellipse([cam_x, cam_y, cam_x + cam_size, cam_y + cam_size], fill=(12, 18, 30, 255), outline=(25, 35, 55, 200), width=1)

    # 7. Speaker Slit
    spk_w = int(screen_w * 0.12)
    spk_h = 4
    spk_x = ox + (outer_w - spk_w) // 2
    spk_y = bezel_thickness // 2 - 2
    draw.rounded_rectangle([spk_x, spk_y, spk_x + spk_w, spk_y + spk_h], radius=2, fill=(20, 22, 26, 255))

    # 8. Home Indicator Bar
    hi_w = int(screen_w * 0.36)
    hi_h = 10
    hi_x = ox + (outer_w - hi_w) // 2
    hi_y = bezel_thickness + screen_h - 22
    draw.rounded_rectangle([hi_x, hi_y, hi_x + hi_w, hi_y + hi_h], radius=5, fill=(0, 0, 0, 90))

    return phone

def add_shadow(img, blur_radius=60, offset_y=45, opacity=125):
    w, h = img.size
    pad = blur_radius * 2 + 60
    canvas_w = w + pad * 2
    canvas_h = h + pad * 2
    
    shadow_layer = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    alpha_mask = img.split()[-1]
    
    s_mask = Image.new('L', (canvas_w, canvas_h), 0)
    s_mask.paste(alpha_mask, (pad, pad + offset_y))
    s_mask = s_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    sd_draw = ImageDraw.Draw(shadow_layer)
    sd_draw.bitmap((0, 0), s_mask, fill=(15, 20, 35, opacity))
    
    c_mask = Image.new('L', (canvas_w, canvas_h), 0)
    c_mask.paste(alpha_mask, (pad, pad + int(offset_y * 0.35)))
    c_mask = c_mask.filter(ImageFilter.GaussianBlur(blur_radius // 4))
    sd_draw.bitmap((0, 0), c_mask, fill=(10, 15, 25, int(opacity * 0.85)))
    
    shadow_layer.paste(img, (pad, pad), img)
    return shadow_layer, pad

def draw_text_centered(draw, text, y, font, fill=(17, 24, 39), max_width=1160, line_gap=1.26):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    if text_w <= max_width:
        x = (CANVAS_W - text_w) // 2
        draw.text((x, y), text, fill=fill, font=font)
        return y + (bbox[3] - bbox[1])
    else:
        words = list(text)
        lines = []
        current = ""
        for char in words:
            test = current + char
            b = draw.textbbox((0, 0), test, font=font)
            if (b[2] - b[0]) > max_width and current:
                lines.append(current)
                current = char
            else:
                current = test
        if current:
            lines.append(current)
        
        curr_y = y
        for line in lines:
            b = draw.textbbox((0, 0), line, font=font)
            x = (CANVAS_W - (b[2] - b[0])) // 2
            draw.text((x, curr_y), line, fill=fill, font=font)
            curr_y += int((b[3] - b[1]) * line_gap)
        return curr_y


def draw_soft_glow(canvas, center, radius, color, alpha=88):
    """A restrained pigment-like light source behind the device."""
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    x, y = center
    gd.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (alpha,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius // 2))
    canvas.alpha_composite(glow)


def add_art_direction(canvas, scene, dark=False):
    """Adds the quiet editorial structure shared by the whole screenshot set."""
    draw = ImageDraw.Draw(canvas)
    accent = scene.get("accent", (255, 107, 53))
    fg = (245, 247, 250) if dark else (22, 28, 38)
    muted = (185, 194, 207) if dark else (92, 104, 123)
    label_font = get_fonts(34, 34)[1]
    micro_font = get_fonts(26, 26)[1]

    # Page marker: it gives the sequence a clear rhythm without competing with the headline.
    marker = scene.get("marker", "GK MIXER · 01")
    draw.rounded_rectangle((88, 86, 394, 143), radius=28, fill=accent + (235,))
    draw.text((117, 100), marker, font=label_font, fill=(255, 255, 255))
    draw.text((CANVAS_W - 274, 105), "PAINT / LAB", font=micro_font, fill=muted)

    h_font, s_font = get_fonts(headline_size=104, subhead_size=46)
    title_y = 218
    end_y = draw_text_centered(draw, scene["headline"], title_y, h_font, fill=fg, max_width=1130, line_gap=1.17)
    draw_text_centered(draw, scene["subhead"], end_y + 44, s_font, fill=muted, max_width=1050, line_gap=1.36)

    # A short rule helps the copy read as one intentional composition at App Store thumbnail size.
    draw.rounded_rectangle((CANVAS_W // 2 - 44, end_y + 18, CANVAS_W // 2 + 44, end_y + 25), radius=4, fill=accent + (255,))


def make_base_canvas(scene):
    bg = scene.get("bg", ((245, 240, 252), (238, 230, 248), (250, 246, 254)))
    base = create_gradient(CANVAS_W, CANVAS_H, bg[0], bg[1], bg[2]).convert("RGBA")
    accent = scene.get("accent", (255, 107, 53))
    draw_soft_glow(base, (CANVAS_W // 2, 1650), 490, accent, alpha=54)
    add_art_direction(base, scene)
    return base

def render_panorama_pair(scene, filename_left, filename_right):
    """
    Renders a true 2-tile panorama:
    Tile Left has the headline & subhead, plus the left half of a giant tilted phone.
    Tile Right has the right half of the phone, perfectly aligned across the seam!
    """
    bg_grad = scene.get("bg", ((245, 240, 252), (238, 230, 248), (250, 246, 254)))
    
    # Combined wide canvas (1320 * 2 = 2640 x 2868)
    TOTAL_W = CANVAS_W * 2
    wide_canvas = create_gradient(TOTAL_W, CANVAS_H, bg_grad[0], bg_grad[1], bg_grad[2]).convert("RGBA")
    # Put the editorial copy and glow in the first tile; the device itself carries across the seam.
    left_canvas = wide_canvas.crop((0, 0, CANVAS_W, CANVAS_H))
    draw_soft_glow(left_canvas, (1040, 1640), 520, scene.get("accent", (255, 107, 53)), alpha=55)
    add_art_direction(left_canvas, scene)
    wide_canvas.alpha_composite(left_canvas, (0, 0))
    draw_soft_glow(wide_canvas, (CANVAS_W + 70, 1650), 570, scene.get("accent", (255, 107, 53)), alpha=30)
    
    # Giant tilted device spanning the seam (centered around seam x = 1320)
    framed = create_uikit_framed_phone(scene["screenshot"], target_screen_w=1120, bezel_style=scene.get("bezel", "titanium_silver"))
    tilted = framed.rotate(-7.5, resample=Image.Resampling.BICUBIC, expand=True)
    tilted_with_shadow, pad = add_shadow(tilted, blur_radius=70, offset_y=55, opacity=135)
    
    tw, th = tilted_with_shadow.size
    # Center around seam x = CANVAS_W (1320)
    seam_x = CANVAS_W + 40
    seam_y = 660
    
    paste_x = seam_x - tw // 2
    paste_y = seam_y - pad
    wide_canvas.paste(tilted_with_shadow, (paste_x, paste_y), tilted_with_shadow)
    
    # Slice wide canvas into two 1320x2868 tiles
    tile_left = wide_canvas.crop((0, 0, CANVAS_W, CANVAS_H))
    tile_right = wide_canvas.crop((CANVAS_W, 0, TOTAL_W, CANVAS_H))
    
    path_l = os.path.join(OUT_DIR, filename_left)
    path_r = os.path.join(OUT_DIR, filename_right)
    tile_left.save(path_l, "PNG", optimize=True)
    tile_right.save(path_r, "PNG", optimize=True)
    print(f"✅ Rendered Panorama Pair:\n   Left:  {filename_left}\n   Right: {filename_right}")

def render_duo_tile(primary_scene, secondary_scene, filename):
    """
    Renders a Duo tile:
    Secondary phone behind on the left (scale ~0.80), primary phone in front on the right.
    """
    bg_grad = primary_scene.get("bg", ((245, 240, 252), (238, 230, 248), (250, 246, 254)))
    canvas = make_base_canvas(primary_scene)
    
    # 1. Secondary phone (behind)
    sec_phone = create_uikit_framed_phone(secondary_scene["screenshot"], target_screen_w=780, bezel_style="space_black")
    sec_with_shadow, sec_pad = add_shadow(sec_phone, blur_radius=50, offset_y=35, opacity=100)
    
    # 2. Primary phone (front)
    pri_phone = create_uikit_framed_phone(primary_scene["screenshot"], target_screen_w=920, bezel_style=primary_scene.get("bezel", "titanium_silver"))
    pri_with_shadow, pri_pad = add_shadow(pri_phone, blur_radius=65, offset_y=50, opacity=140)
    
    # Paste secondary (behind, offset left)
    sw, sh = sec_with_shadow.size
    canvas.paste(sec_with_shadow, (120 - sec_pad, 740 - sec_pad), sec_with_shadow)
    
    # Paste primary (front, offset right)
    pw, ph = pri_with_shadow.size
    canvas.paste(pri_with_shadow, (340 - pri_pad, 700 - pri_pad), pri_with_shadow)
    
    out_path = os.path.join(OUT_DIR, filename)
    canvas.save(out_path, "PNG", optimize=True)
    print(f"✅ Rendered Duo Tile: {filename}")

def render_standard_scene(scene_config, filename):
    canvas = make_base_canvas(scene_config)
    
    target_w = scene_config.get("screen_w", 940)
    bezel_style = scene_config.get("bezel", "titanium_silver")
    
    framed = create_uikit_framed_phone(
        scene_config["screenshot"],
        target_screen_w=target_w,
        bezel_style=bezel_style
    )
    
    rotation = scene_config.get("rotate", 0)
    if rotation != 0:
        framed = framed.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    
    framed_with_shadow, pad = add_shadow(framed, blur_radius=60, offset_y=45, opacity=125)
    fw, fh = framed_with_shadow.size
    
    phone_center_x = CANVAS_W // 2 + scene_config.get("offset_x", 0)
    phone_top_y = scene_config.get("phone_y", 730)
    
    paste_x = phone_center_x - fw // 2
    paste_y = phone_top_y - pad
    
    canvas.paste(framed_with_shadow, (paste_x, paste_y), framed_with_shadow)
    
    out_path = os.path.join(OUT_DIR, filename)
    canvas.save(out_path, "PNG", optimize=True)
    print(f"✅ Rendered Standard Tile: {filename}")

if __name__ == "__main__":
    print("🚀 Rendering Enhanced App Store Screenshots with Panorama, Duo & iPhone UIKit...")
    
    # 1. Panorama Pair (Mixer Workbench + Color Detail across 2 tiles)
    render_panorama_pair(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "01_mixer_workbench.png"),
            "headline": "把颜色配成配方",
            "subhead": "目标色进来，毫升与滴数马上清楚",
            "marker": "GK MIXER · 01",
            "accent": (246, 121, 52),
            "bg": ((255, 247, 240), (254, 234, 220), (255, 250, 246)),
            "bezel": "cosmic_orange"
        },
        "01_panorama_left_mixer.png",
        "02_panorama_right_mixer.png"
    )
    
    # 2. Duo Tile (Color Picker in front, Card Adjust behind)
    render_duo_tile(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "02_color_picker.png"),
            "headline": "从模型，取到准确颜色",
            "subhead": "点一下实拍图，即刻生成漆料指派",
            "marker": "GK MIXER · 02",
            "accent": (120, 92, 220),
            "bg": ((245, 242, 252), (236, 232, 248), (252, 250, 255)),
            "bezel": "titanium_silver"
        },
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "03_card_adjust.png"),
        },
        "03_duo_color_picker_inspect.png"
    )

    # 3. Card Adjust Tilt
    render_standard_scene(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "03_card_adjust.png"),
            "headline": "色卡标注，自动整齐",
            "subhead": "智能引线与边缘对齐，一键导出专业色卡",
            "marker": "GK MIXER · 03",
            "accent": (53, 132, 210),
            "screen_w": 950,
            "rotate": -7.0,
            "phone_y": 740,
            "bg": ((242, 247, 252), (230, 239, 248), (250, 253, 255)),
            "bezel": "deep_blue"
        },
        "04_card_adjust_tilt.png"
    )

    # 4. Tuning Sliders Tilt-Right
    render_standard_scene(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "04_tuning_sliders.png"),
            "headline": "每一滴，都看得见",
            "subhead": "滑动微调，真实混色即时反馈",
            "marker": "GK MIXER · 04",
            "accent": (82, 161, 96),
            "screen_w": 940,
            "rotate": 6.5,
            "phone_y": 730,
            "bg": ((246, 249, 244), (235, 244, 232), (252, 254, 250)),
            "bezel": "titanium_silver"
        },
        "05_tuning_sliders_tilt_right.png"
    )

    # 5. Palette Library Classic
    render_standard_scene(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "05_palette_library.png"),
            "headline": "让每套配色，都有归处",
            "subhead": "模型专属色板、配方与灵感一键归档",
            "marker": "GK MIXER · 05",
            "accent": (133, 96, 193),
            "screen_w": 930,
            "phone_y": 740,
            "bg": ((248, 245, 252), (239, 234, 248), (253, 251, 255)),
            "bezel": "space_black"
        },
        "06_palette_library_classic.png"
    )

    # 6. Database Grid Clean
    render_standard_scene(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "06_database_grid.png"),
            "headline": "你的模型漆，都在这里",
            "subhead": "主流品牌色号、参数与质感，随时查",
            "marker": "GK MIXER · 06",
            "accent": (70, 135, 192),
            "screen_w": 930,
            "phone_y": 740,
            "bg": ((255, 255, 255), (246, 247, 250), (255, 255, 255)),
            "bezel": "titanium_silver"
        },
        "07_database_grid_clean.png"
    )

    # 7. Color Detail Modal
    render_standard_scene(
        {
            "screenshot": os.path.join(SCREENSHOTS_DIR, "07_color_detail_modal.png"),
            "headline": "参数，都收在一张卡里",
            "subhead": "质感、光泽与混色特性，一眼看全",
            "marker": "GK MIXER · 07",
            "accent": (232, 119, 62),
            "screen_w": 930,
            "phone_y": 740,
            "bg": ((255, 248, 242), (252, 238, 226), (255, 252, 248)),
            "bezel": "cosmic_orange"
        },
        "08_color_detail_modal_sheet.png"
    )

    print("🎉 All App Store screenshots successfully rendered with full Panorama & Duo support!")
