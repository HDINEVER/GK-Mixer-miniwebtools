#!/usr/bin/env node
/**
 * 批量生成 GK-Mixer AI 涂装点数加密兑换码 (CDK)
 * 无需预先写入数据库，直接用 CREDITS_SIGNING_SECRET 进行 HMAC-SHA256 签名，
 * 可直接导入 面包多 / 爱发电 / 闲鱼自动发货，用户在网页粘贴即可核销并写入 Cloudflare KV 防重放。
 *
 * 用法示例：
 *   CREDITS_SIGNING_SECRET="你的签名密钥" node scripts/generate-redeem-codes.mjs --points=100 --count=50
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);

const secret = process.env.CREDITS_SIGNING_SECRET || args.secret || "";
const points = parseInt(args.points || "100", 10);
const count = parseInt(args.count || "10", 10);

if (!secret) {
  console.error(
    "❌ 请提供环境变量 CREDITS_SIGNING_SECRET（需与 Cloudflare Pages 环境变量中的 CREDITS_SIGNING_SECRET 完全一致）\n" +
      '示例：CREDITS_SIGNING_SECRET="my-super-secret-key" npm run gen:cdk -- --points=100 --count=20'
  );
  process.exit(1);
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function randomNonce(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function signCode(pts, nonce) {
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`GKM-CDK:v1:${pts}:${nonce}`)
    .digest("hex")
    .toUpperCase();
  return hmac.slice(0, 10);
}

const codes = [];
for (let i = 0; i < count; i++) {
  const nonce = randomNonce(8);
  const sig = signCode(points, nonce);
  codes.push(`GKM-${points}-${nonce}-${sig}`);
}

const shouldSave = args["no-save"] !== "true";
let savedFilePath = "";
if (shouldSave) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(__dirname, "../.redeem-codes");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = args.out || `cdk-${points}pts-${count}pcs-${stamp}.txt`;
  savedFilePath = path.isAbsolute(fileName) ? fileName : path.join(outDir, fileName);
  const header = [
    `# GK-Mixer AI 兑换码批次 (${points} 点 / 共 ${count} 个)`,
    `# 可生成: 1080p 试色 ${Math.floor(points / 5)} 张 | 2K Pro 精修 ${Math.floor(points / 10)} 张`,
    `# 生成时间: ${new Date().toLocaleString("zh-CN")}`,
    "",
  ].join("\n");
  fs.writeFileSync(savedFilePath, header + codes.join("\n") + "\n", "utf8");
}

console.log(
  `# 已生成 ${count} 张 [${points} 灵感点] 兑换码（1080p=${Math.floor(points / 5)}张 / 2K Pro=${Math.floor(points / 10)}张）：\n`
);
console.log(codes.join("\n"));
if (savedFilePath) {
  console.log(`\n✅ 已自动保存至本地文件（已加入 .gitignore 不会上传仓库）：\n${savedFilePath}`);
}
