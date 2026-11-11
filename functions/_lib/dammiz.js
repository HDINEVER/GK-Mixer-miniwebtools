/**
 * 达米兹（dammiz.cn）取件方案只读代理 —— Cloudflare Pages Function 与 Vite dev 中间件共用
 *
 * - 只读取公开方案详情接口 GET https://www.dammiz.cn/api/picking/schemes/{id}
 * - 返回前剥离所有图片 / 用户信息，只保留「标题 + 部位 + 板件号 + 零件号 + 数量」文本数据
 *   （GK-Mixer 不引入任何板件实拍图）
 */

export const DAMMIZ_ORIGIN = 'https://www.dammiz.cn';

export const isValidSchemeId = (id) => /^\d{1,8}$/.test(String(id ?? ''));

const str = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));

/** 将达米兹原始方案数据裁剪为纯文本取件数据 */
export const sanitizeDammizScheme = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const kit = raw.modelKit && typeof raw.modelKit === 'object' ? raw.modelKit : {};
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  return {
    id: Number(raw.id),
    title: str(raw.title, 200),
    revision: str(raw.editorRevision, 80) || undefined,
    updatedAt: Number(raw.updatedAt) || undefined,
    modelKit: {
      name: str(kit.name, 200),
      brand: { name: str(kit.brand?.name, 60) },
      productLine: { name: str(kit.productLine?.name, 60) },
    },
    sections: sections.slice(0, 200).map((s) => ({
      name: str(s?.name, 80),
      parts: (Array.isArray(s?.parts) ? s.parts : []).slice(0, 2000).map((p) => ({
        runnerName: str(p?.runnerName, 24),
        partName: str(p?.partName, 24),
        quantity: Number(p?.quantity) || 1,
        notes: str(p?.notes, 120),
      })),
    })),
  };
};

/**
 * 拉取并裁剪方案；返回 { status, body }，body 统一为 { code, msg, data }
 * @param {string|number} id
 * @param {typeof fetch} fetchImpl
 */
export const fetchDammizScheme = async (id, fetchImpl = fetch) => {
  if (!isValidSchemeId(id)) {
    return { status: 400, body: { code: 400, msg: '无效的方案编号' } };
  }
  let upstream;
  try {
    upstream = await fetchImpl(`${DAMMIZ_ORIGIN}/api/picking/schemes/${id}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GK-Mixer-PartsChecklist/1.0 (+text-only import)',
      },
    });
  } catch (err) {
    return { status: 502, body: { code: 502, msg: `无法连接达米兹：${err?.message || 'network error'}` } };
  }
  let json = null;
  try {
    json = await upstream.json();
  } catch {
    /* 非 JSON */
  }
  if (!upstream.ok || !json || json.code !== 0 || !json.data) {
    const status = upstream.status === 200 ? 404 : upstream.status || 502;
    return {
      status,
      body: { code: status, msg: json?.msg || (status === 404 ? '方案不存在或未公开' : '达米兹接口返回异常') },
    };
  }
  return { status: 200, body: { code: 0, msg: 'success', data: sanitizeDammizScheme(json.data) } };
};
