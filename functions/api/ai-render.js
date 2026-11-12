/**
 * API 路由：POST /api/ai-render
 * 支持两种模式：
 * 1. 官方 Seedream 通道 (channel: "official") —— 校验通行证点数、调用火山方舟 Seedream，失败自动退点
 * 2. 自带 API 通道 (channel: "byok") —— 无状态解决浏览器 CORS，0 点数扣费，支持火山豆包 / Gemini / OpenAI / 兼容中转站
 */
import { processAiRenderRequest } from "../_lib/aiStudio.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";

  try {
    const body = await request.json();
    const result = await processAiRenderRequest(env, body, clientIp);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status =
      err?.code === "INSUFFICIENT_CREDITS"
        ? 402
        : err?.code === "OFFICIAL_NOT_CONFIGURED"
        ? 503
        : 400;
    return new Response(
      JSON.stringify({
        ok: false,
        code: err?.code || "RENDER_FAILED",
        error: err?.message || "AI 图像生成失败，请稍后重试",
        wallet: err?.wallet || undefined,
      }),
      {
        status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
