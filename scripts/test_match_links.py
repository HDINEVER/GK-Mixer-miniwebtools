import json
import re

STORE_URL = "https://m.tb.cn/h.8CDUKqPH9x4BRh3"

URL_MAP = {
    "NAL_CLASSIC_SKIN_BROWN": "https://e.tb.cn/h.8DN86WKXI7cKZRN?tk=4nqYToXL3fE", # 经典薄涂 肤/棕
    "NAL_WARGAME_RED_YELLOW": "https://e.tb.cn/h.8xMHHQA1wAtHJN5?tk=fybfToXpHwn", # 战棋薄涂 红/黄
    "NAL_WARGAME_BROWN_SKIN": "https://e.tb.cn/h.8DNjP5S2VLQJkPa?tk=5l0qToXLG3e", # 战棋薄涂 褐/肤
    "NDL_WARGAME_BWG":        "https://e.tb.cn/h.8xMsvwmhcZGGECP?tk=WMQQToXpxC9", # 战棋底涂 黑白灰
    "NDL_WARGAME_BROWN_SKIN": "https://e.tb.cn/h.8CDHD7uMOR6x629?tk=G6FvToXJD2R", # 战棋底涂 褐/肤
    "NDL_CLASSIC_RYG":        "https://e.tb.cn/h.8B8Cb25QDo7RSBk?tk=MTlSToXrjIs", # 经典底涂 红黄绿
    "NPM_BLUE":               "https://e.tb.cn/h.8B8vhydqxVWcqkH?tk=jqNWToXotRk", # 预调喷涂 蓝
    "NPM_CLEAR":              "https://e.tb.cn/h.8xMtSRrXvECVu7y?tk=dpXLToXpnwZ", # 预调喷涂 透明
    "NPM_ART":                "https://e.tb.cn/h.8xMG3tVFeFJgoh1?tk=5nXCToXqfWn", # 预调喷涂 美术用色
    "NPM_SKIN":               "https://e.tb.cn/h.8B8DoTRnL9UcEg3?tk=l786ToXKVSj", # 预调喷涂 肤色
    "NPM_YELLOW_ORANGE":      "https://e.tb.cn/h.8DNkJTjIkMl0zcf?tk=tB3yToXr7xJ", # 预调喷涂 黄/橙
    "NPM_PURPLE":             "https://e.tb.cn/h.8DNlcB74l2bEACe?tk=Z3FtToXrgtP", # 预调喷涂 紫
    "NCL_PURPLE_SKIN_GREEN":  "https://e.tb.cn/h.8xMuJ3rCrzzMG3w?tk=lSYLToXqkEq", # 对比漆 紫/肤/绿
    "NCL_RYB":                "https://e.tb.cn/h.8DN9qFQljEa1P9Z?tk=Ac5iToXJdyi", # 对比漆 红黄蓝
    "NCL_BWG_BROWN":          "https://e.tb.cn/h.8B8x7PV6e6Jo2ep?tk=0MiNToXqASm", # 对比漆 黑白灰褐
    "NSL_WARGAME":            "https://e.tb.cn/h.8xMtZNKhUOc5Zfn?tk=4jSSToXKZ5N", # 战棋阴影洗漆
    "NSL_CLASSIC":            "https://e.tb.cn/h.8xMu0paYJPs5tTQ?tk=ut77ToXJqwG", # 经典阴影洗漆
    "NAF_FLUORESCENT":        "https://e.tb.cn/h.8CDrtee89THnkC9?tk=US71ToXpgeP", # 笔涂荧光
    "NFL_FILTER":             "https://e.tb.cn/h.8xMGqv4JcBf09qD?tk=X1mCToXqQBW", # 滤镜漆
    "NTL_EFFECT":             "https://e.tb.cn/h.8B8womVTykGWg89?tk=5MSaToXKPyO", # 特效漆
    "NPU_SURFACER":           "https://e.tb.cn/h.8xMujK0Holuwkn9?tk=vELPToXKq4w", # 喷涂水补土
}

def match_paint_url(paint):
    code = paint.get('code', '')
    name = paint.get('name', '')
    p_set = paint.get('set', '')
    finish = paint.get('finish', '')
    
    # 1. 荧光色
    if code.startswith('NAF') or code.startswith('NFM') or finish == 'fluorescent':
        return URL_MAP['NAF_FLUORESCENT']
        
    # 2. 特效漆
    if code.startswith('NTL') or '特效' in p_set:
        return URL_MAP['NTL_EFFECT']
        
    # 3. 滤镜罩染漆
    if code.startswith('NFL') or '滤镜' in p_set:
        return URL_MAP['NFL_FILTER']
        
    # 4. 水补土
    if code.startswith('NPU') or code.startswith('NAU') or '水补土' in p_set:
        return URL_MAP['NPU_SURFACER']
        
    # 5. 阴影漆 NSL
    if code.startswith('NSL') or finish == 'wash' and '阴影' in p_set:
        if '经典' in p_set:
            return URL_MAP['NSL_CLASSIC']
        return URL_MAP['NSL_WARGAME']
        
    # 6. 对比漆 NCL
    if code.startswith('NCL') or '对比' in p_set:
        if any(w in name for w in ['黑', '白', '灰', '褐', '骨', '棕', '垢', '污', '蛇皮']):
            return URL_MAP['NCL_BWG_BROWN']
        elif any(w in name for w in ['紫', '肤', '绿', '青', '翠', '苔', '翡']):
            return URL_MAP['NCL_PURPLE_SKIN_GREEN']
        elif any(w in name for w in ['红', '黄', '蓝', '橙', '朱', '绯', '赤', '金']):
            return URL_MAP['NCL_RYB']
        return URL_MAP['NCL_BWG_BROWN']
        
    # 7. 预调喷涂漆 NPM
    if code.startswith('NPM') or '预调' in p_set or '喷涂' in p_set and finish == 'standard':
        if any(w in name for w in ['蓝', '海', '天', '青', '靛']):
            return URL_MAP['NPM_BLUE']
        elif any(w in name for w in ['肤', '肉', '玉', '粉']):
            return URL_MAP['NPM_SKIN']
        elif any(w in name for w in ['黄', '橙', '金', '日', '暖']):
            return URL_MAP['NPM_YELLOW_ORANGE']
        elif any(w in name for w in ['紫', '玫', '红']):
            return URL_MAP['NPM_PURPLE']
        elif any(w in name for w in ['美术', '三原色', '红', '黄', '蓝', '黑', '白']):
            return URL_MAP['NPM_ART']
        return URL_MAP['NPM_ART']
        
    # 8. 预调喷涂透明色
    if finish == 'clear':
        return URL_MAP['NPM_CLEAR']
        
    # 9. 底涂漆 NDL
    if code.startswith('NDL'):
        if '经典' in p_set:
            return URL_MAP['NDL_CLASSIC_RYG']
        else: # 战棋
            if any(w in name for w in ['黑', '白', '灰']):
                return URL_MAP['NDL_WARGAME_BWG']
            elif any(w in name for w in ['褐', '肤', '肉', '泥', '沙', '土', '棕']):
                return URL_MAP['NDL_WARGAME_BROWN_SKIN']
            else:
                return URL_MAP['NDL_WARGAME_BROWN_SKIN']
                
    # 10. 薄涂漆 NAL
    if code.startswith('NAL'):
        if '经典' in p_set:
            return URL_MAP['NAL_CLASSIC_SKIN_BROWN']
        else: # 战棋
            if any(w in name for w in ['红', '黄', '橙', '朱', '绯', '赤', '金']):
                return URL_MAP['NAL_WARGAME_RED_YELLOW']
            elif any(w in name for w in ['褐', '肤', '肉', '泥', '沙', '土', '棕']):
                return URL_MAP['NAL_WARGAME_BROWN_SKIN']
            else:
                return URL_MAP['NAL_WARGAME_RED_YELLOW']
                
    # 11. 金属漆及其他无法精确对应的
    return STORE_URL

with open('/Users/krooshuang/code/ios-GK-mixer/NightWorks_Output/NightWorksCatalog.json') as f:
    catalog = json.load(f)

matched_counts = {}
for p in catalog['paints']:
    url = match_paint_url(p)
    matched_counts[url] = matched_counts.get(url, 0) + 1

print(f"Total paints evaluated: {len(catalog['paints'])}")
for url, cnt in sorted(matched_counts.items(), key=lambda x: x[1], reverse=True):
    is_store = (url == STORE_URL)
    tag = "【官方店铺首页兜底】" if is_store else "【精准宝贝链接】"
    print(f"  {cnt:3d} 款 -> {tag} {url[:45]}...")
