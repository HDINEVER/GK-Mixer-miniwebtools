/**
 * API 路由：GET /api/dammiz-scheme?id=917
 * 代理读取达米兹公开取件方案（仅文本数据，剥离板件实拍图），解决浏览器 CORS 限制
 */
import { fetchDammizScheme } from '../_lib/dammiz.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ code: 405, msg: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const id = new URL(request.url).searchParams.get('id') ?? '';
  const { status, body } = await fetchDammizScheme(id);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=120' : 'no-store',
    },
  });
}
