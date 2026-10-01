import json
import zipfile
import xml.etree.ElementTree as ET

PATH_ALL = "/Users/krooshuang/Downloads/夜之工坊颜料类产品大全(1).xlsx"

# 1. Read Sheet 5 to get NMP english names
nmp_en_names = {}
with zipfile.ZipFile(PATH_ALL, 'r') as z:
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in tree.findall('.//ns:si', ns):
            shared.append(''.join(t.text or '' for t in si.findall('.//ns:t', ns)))
            
    stree = ET.fromstring(z.read('xl/worksheets/sheet5.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
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
        code = cells.get('I', '').strip()
        en = cells.get('K', '').strip()
        if code and en:
            nmp_en_names[code] = en

print(f"Loaded {len(nmp_en_names)} NMP English names from Sheet 5.")

def get_commodity_category(code, current_set, finish):
    if code.startswith('NAL'):
        return '薄涂漆'
    elif code.startswith('NDL'):
        return '底涂漆'
    elif code.startswith('NML'):
        return '笔涂金属漆'
    elif code.startswith('NMP'):
        return '预调喷涂金属漆'
    elif code.startswith('NCL'):
        return '对比漆'
    elif code.startswith('NSL'):
        return '阴影洗漆'
    elif code.startswith('NPM'):
        return '预调喷涂消光色'
    elif code.startswith('NFL'):
        return '滤镜罩染漆'
    elif code.startswith('NAF'):
        return '笔涂荧光色'
    elif code.startswith('NFM'):
        return '预调喷涂荧光色'
    elif code.startswith('NTL'):
        return '特效漆'
    elif code.startswith('NPU') or code.startswith('NAU'):
        return '战棋水补土'
    return current_set

# Update NightWorksCatalog.json
nw_path = '/Users/krooshuang/code/ios-GK-mixer/NightWorks_Output/NightWorksCatalog.json'
with open(nw_path, 'r', encoding='utf-8') as f:
    nw_data = json.load(f)

for p in nw_data['paints']:
    code = p['code']
    # If NMP has English name from Sheet 5, enrich the display name
    if code in nmp_en_names and '/' not in p['name']:
        p['name'] = f"{p['name']} / {nmp_en_names[code]}"
    # Set the official commodity category
    p['set'] = get_commodity_category(code, p['set'], p['finish'])

with open(nw_path, 'w', encoding='utf-8') as f:
    json.dump(nw_data, f, ensure_ascii=False, indent=2)

# Update iOS PaintCatalog.json
ios_catalog_path = '/Users/krooshuang/code/ios-GK-mixer/GK-Mixer/GK-Mixer/Resources/PaintCatalog.json'
with open(ios_catalog_path, 'r', encoding='utf-8') as f:
    ios_catalog = json.load(f)

filtered = [p for p in ios_catalog['paints'] if p.get('brand') != 'Night Works']
merged = filtered + nw_data['paints']
ios_catalog['paints'] = merged

with open(ios_catalog_path, 'w', encoding='utf-8') as f:
    json.dump(ios_catalog, f, ensure_ascii=False)

# Update Web PaintCatalog.json
web_catalog_path = '/Users/krooshuang/code/ios-GK-mixer/GK-Mixer-miniwebtools-main/public/PaintCatalog.json'
with open(web_catalog_path, 'w', encoding='utf-8') as f:
    json.dump(ios_catalog, f, ensure_ascii=False)

print("Updated categories and English names across all catalogs!")
