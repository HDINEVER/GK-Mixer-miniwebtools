#!/usr/bin/env python3
"""
Extracts Night Works (夜之工坊) paint catalog data and thumbnails:
- Merges '颜料体系2026.9.29.xlsx' with '夜之工坊颜料类产品大全(1).xlsx'
- Filters valid color paints (excludes solvents, pure thinners, clear topcoats)
- Samples HEX from the official card color swatches
- Computes CIELAB coordinates (D65) matching CIEDE2000 in GK-Mixer
- Resizes and compresses thumbnails into 256x256 JPEGs
- Outputs clean NightWorksCatalog.json and image folder
"""

import os
import io
import re
import json
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image

PATH_SYS = "/Users/krooshuang/Downloads/颜料体系2026.9.29.xlsx"
PATH_ALL = "/Users/krooshuang/Downloads/夜之工坊颜料类产品大全(1).xlsx"
OUT_DIR = "/Users/krooshuang/code/ios-GK-mixer/NightWorks_Output"
WEB_DIR = "/Users/krooshuang/code/ios-GK-mixer/GK-Mixer-miniwebtools-main/public/paints/nightworks"

os.makedirs(os.path.join(OUT_DIR, "paints"), exist_ok=True)
os.makedirs(WEB_DIR, exist_ok=True)

# 1. Load English Names & Barcodes from '夜之工坊颜料类产品大全'
en_names = {}
barcodes = {}

with zipfile.ZipFile(PATH_ALL, 'r') as z:
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in tree.findall('.//ns:si', ns):
            shared.append(''.join(t.text or '' for t in si.findall('.//ns:t', ns)))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns_wb = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for s in wb.findall('.//ns:sheet', ns_wb):
        sheet_id = s.attrib.get('sheetId')
        sheet_xml = f'xl/worksheets/sheet{sheet_id}.xml'
        if sheet_xml in z.namelist():
            stree = ET.fromstring(z.read(sheet_xml))
            for r in stree.findall('.//ns:row', ns)[1:]:
                cells = {}
                for c in r.findall('ns:c', ns):
                    ref = ''.join(filter(str.isalpha, c.attrib.get('r', '')))
                    val = c.find('ns:v', ns)
                    t = c.attrib.get('t')
                    content = ''
                    if val is not None and val.text:
                        content = shared[int(val.text)] if t == 's' else val.text
                    cells[ref] = content
                code = cells.get('B', '').strip()
                barcode = cells.get('D', '').strip()
                en = cells.get('E', '').strip()
                if code:
                    if en: en_names[code] = en
                    if barcode: barcodes[code] = barcode

print(f"Loaded {len(en_names)} English names and {len(barcodes)} barcodes from catalog.")

# 2. Extract cellimages mapping in '颜料体系2026.9.29.xlsx'
with zipfile.ZipFile(PATH_SYS, 'r') as z:
    rels_tree = ET.fromstring(z.read('xl/_rels/cellimages.xml.rels'))
    rels_ns = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
    rid_to_target = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels_tree.findall('.//r:Relationship', rels_ns)}
    
    cell_tree = ET.fromstring(z.read('xl/cellimages.xml'))
    xdr_ns = {'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
              'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
              'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    img_id_to_target = {}
    for pic in cell_tree.findall('.//xdr:pic', xdr_ns):
        cnv = pic.find('.//xdr:cNvPr', xdr_ns)
        blip = pic.find('.//a:blip', xdr_ns)
        if cnv is not None and blip is not None:
            name = cnv.attrib.get('name')
            embed = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
            target = rid_to_target.get(embed)
            if name and target:
                img_id_to_target[name] = target

    shared1 = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in tree.findall('.//ns:si', ns):
            shared1.append(''.join(t.text or '' for t in si.findall('.//ns:t', ns)))
            
    sheet1 = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    def rgb_to_lab(r, g, b):
        def lin(c):
            c_norm = c / 255.0
            return ((c_norm + 0.055) / 1.055) ** 2.4 if c_norm > 0.04045 else c_norm / 12.92
        r_l, g_l, b_l = lin(r), lin(g), lin(b)
        x = (r_l * 0.4124564 + g_l * 0.3575761 + b_l * 0.1804375) * 100
        y = (r_l * 0.2126729 + g_l * 0.7151522 + b_l * 0.0721750) * 100
        z = (r_l * 0.0193339 + g_l * 0.1191920 + b_l * 0.9503041) * 100
        def f(t):
            return t ** (1/3) if t > 0.008856 else (7.787 * t + 16 / 116)
        x_n = f(x / 95.047)
        y_n = f(y / 100.0)
        z_n = f(z / 108.883)
        return [
            round(116 * y_n - 16, 4),
            round(500 * (x_n - y_n), 4),
            round(200 * (y_n - z_n), 4)
        ]

    paints = []
    skipped = 0
    
    for r in sheet1.findall('.//ns:row', ns)[1:]:
        cells = {}
        formulas = {}
        for c in r.findall('ns:c', ns):
            ref = ''.join(filter(str.isalpha, c.attrib.get('r', '')))
            val = c.find('ns:v', ns)
            t = c.attrib.get('t')
            content = ''
            if val is not None and val.text:
                content = shared1[int(val.text)] if t == 's' else val.text
            cells[ref] = content
            f = c.find('ns:f', ns)
            if f is not None and f.text:
                formulas[ref] = f.text
                
        code = cells.get('A', '').strip()
        if not code:
            continue
            
        name_zh = cells.get('B', '').strip()
        name_en = cells.get('C', '').strip() or en_names.get(code, '')
        series = cells.get('D', '').strip()
        finish_raw = cells.get('E', '').strip()
        paint_type = cells.get('F', '').strip()
        
        # Filter non-color products
        if finish_raw in ['溶剂', '媒介'] or '溶剂' in series or '媒介' in series:
            skipped += 1
            continue
        if code in ['NAP001', 'NAP002', 'NAP003', 'NAP004', 'NAP005', 'NPV001', 'NPV002', 'NPV003', 'NPV004', 'NPV005']:
            skipped += 1
            continue
            
        # Determine finish
        finish = "standard"
        if finish_raw == "金属":
            finish = "metallic"
        elif finish_raw == "透明":
            finish = "clear"
        elif finish_raw == "荧光":
            finish = "fluorescent"
        elif finish_raw == "渍洗/旧化":
            finish = "wash"
        elif "对比漆" in series or "滤镜" in series:
            finish = "wash"
        elif "特效" in series or finish_raw in ["其它", "其他"]:
            finish = "other"
            
        mixable = finish in ["standard", "wash"]
        
        # Extract thumbnail image
        disp_f = formulas.get('H', '')
        target_img = ''
        if 'DISPIMG' in disp_f:
            m = re.search(r'ID_[A-F0-9]+', disp_f)
            if m:
                target_img = img_id_to_target.get(m.group(0), '')

        hex_code = "#FFFFFF"
        if target_img:
            img_zip_path = f"xl/{target_img}"
            if img_zip_path in z.namelist():
                img_data = z.read(img_zip_path)
                try:
                    pil_img = Image.open(io.BytesIO(img_data)).convert('RGB')
                    w, h = pil_img.size
                    # Sample color swatch rectangle: around (0.7 * w, 0.63 * h)
                    cx, cy = int(w * 0.70), int(h * 0.63)
                    patch = pil_img.crop((cx - 15, cy - 15, cx + 15, cy + 15))
                    pixels = list(patch.getdata())
                    r_avg = sum(p[0] for p in pixels) // len(pixels)
                    g_avg = sum(p[1] for p in pixels) // len(pixels)
                    b_avg = sum(p[2] for p in pixels) // len(pixels)
                    hex_code = f"#{r_avg:02X}{g_avg:02X}{b_avg:02X}"
                    
                    # Create 256x256 thumbnail
                    thumb = pil_img.copy()
                    thumb.thumbnail((256, 256), Image.Resampling.LANCZOS)
                    
                    # Save to OUT_DIR and WEB_DIR
                    out_thumb_path = os.path.join(OUT_DIR, "paints", f"{code}.jpg")
                    web_thumb_path = os.path.join(WEB_DIR, f"{code}.jpg")
                    thumb.save(out_thumb_path, "JPEG", quality=85, optimize=True)
                    thumb.save(web_thumb_path, "JPEG", quality=85, optimize=True)
                except Exception as e:
                    print(f"Error processing image for {code}: {e}")

        r_val = int(hex_code[1:3], 16)
        g_val = int(hex_code[3:5], 16)
        b_val = int(hex_code[5:7], 16)
        lab_val = rgb_to_lab(r_val, g_val, b_val)
        
        display_name = f"{name_zh} / {name_en}" if name_en else name_zh
        
        paint_entry = {
            "id": f"nightworks-{code.lower()}",
            "brand": "Night Works",
            "code": code,
            "name": display_name,
            "hex": hex_code,
            "set": series.replace("系列", "").strip(),
            "finish": finish,
            "source": "night-works-official",
            "approx": True,
            "lab": lab_val,
            "mixable": mixable,
            "barcode": barcodes.get(code, ""),
            "paintType": paint_type,
            "shopUrl": "https://m.tb.cn/h.8CDUKqPH9x4BRh3"
        }
        paints.append(paint_entry)

catalog_data = {
    "version": 1,
    "brand": "Night Works",
    "brandZh": "夜之工坊",
    "officialShopUrl": "https://m.tb.cn/h.8CDUKqPH9x4BRh3",
    "taobaoKouling": "87🔐Tr2FToXdkqf《 https://m.tb.cn/h.8CDUKqPH9x4BRh3  CZ193 夜之工坊",
    "totalPaints": len(paints),
    "paints": paints
}

out_json_path = os.path.join(OUT_DIR, "NightWorksCatalog.json")
with open(out_json_path, "w", encoding="utf-8") as f:
    json.dump(catalog_data, f, ensure_ascii=False, indent=2)

print(f"\nProcessing Complete!")
print(f"Total valid color paints: {len(paints)}")
print(f"Skipped non-color items: {skipped}")
print(f"Wrote Catalog JSON: {out_json_path}")
print(f"Thumbnails saved in: {os.path.join(OUT_DIR, 'paints')}")
print(f"Thumbnails mirrored to web public: {WEB_DIR}")
