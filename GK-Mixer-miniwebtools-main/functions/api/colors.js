/**
 * API 路由：/api/colors
 * 示例：演示如何处理来自前端的 POST 请求
 */
export async function onRequest(context) {
  const { request } = context;

  // 仅处理 OPTIONS 和 POST 请求
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  if (request.method === 'POST') {
    try {
      const data = await request.json();
      
      // 示例：验证颜色数据
      if (!data.colors || !Array.isArray(data.colors)) {
        return new Response(
          JSON.stringify({ error: 'Invalid request: colors array required' }),
          {
            status: 400,
            headers: getCORSHeaders({
              'Content-Type': 'application/json',
            }),
          }
        );
      }

      // 返回处理结果
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Colors received',
          colorCount: data.colors.length,
          colors: data.colors,
        }),
        {
          status: 200,
          headers: getCORSHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse request body' }),
        {
          status: 400,
          headers: getCORSHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );
    }
  }

  // 其他方法返回 405
  return new Response('Method Not Allowed', { status: 405 });
}

// CORS 处理
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(),
  });
}

// CORS 响应头
function getCORSHeaders(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  };
}
