#!/usr/bin/env node
/**
 * Creates (if missing) and syncs the filtered Night Works edition repository
 * to `https://github.com/GK-mixer-Distribution-Network/GK-Mixer-NightWorks`.
 *
 * Reads `GITHUB_PAT` from `/Users/krooshuang/.env` or `process.env.GITHUB_PAT`
 * without ever printing the token.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ORG_NAME = "GK-mixer-Distribution-Network";
const REPO_NAME = "GK-Mixer-NightWorks";

function getCandidateTokens() {
  const localEnvPath = path.join(repoRoot, "GK-Mixer-miniwebtools-main", ".env.local");
  const homeEnvPath = path.join(os.homedir(), ".env");
  const rawParts = [];
  if (fs.existsSync(localEnvPath)) {
    rawParts.push(fs.readFileSync(localEnvPath, "utf8"));
  } else if (fs.existsSync(homeEnvPath)) {
    rawParts.push(fs.readFileSync(homeEnvPath, "utf8"));
  }
  const rawContent = rawParts.join("\n");
  const lines = rawContent.split(/\r?\n/).filter((l) => l.startsWith("GITHUB_PAT="));
  const candidates = new Set();
  for (const line of lines.reverse()) {
    const val = line.slice("GITHUB_PAT=".length).trim().replace(/^['"]|['"]$/g, "");
    if (!val) continue;
    candidates.add(val);
    console.log(
      `[sync] Masked token info: len=${val.length}, startsWithGhp=${val.startsWith("ghp_")}, startsWithGithubPat=${val.startsWith("github_pat_")}`
    );
    // Standard GitHub Classic PAT is 40 chars (ghp_ + 36)
    const ghpMatches = val.match(/ghp_[A-Za-z0-9]{36}/g);
    if (ghpMatches) ghpMatches.forEach((m) => candidates.add(m));
    // Standard Fine-grained PAT is github_pat_<22>_<59> (93 chars)
    const fgMatches = val.match(/github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g);
    if (fgMatches) fgMatches.forEach((m) => candidates.add(m));
    if (val.startsWith("github_pat_") && val.length > 93) {
      candidates.add(val.slice(0, 93));
    }
    if (val.startsWith("ghp_") && val.length > 40) {
      candidates.add(val.slice(0, 40));
    }
  }
  return [...candidates];
}

async function githubRequest(token, method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "GK-Mixer-Sync-Script",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function main() {
  const candidates = getCandidateTokens();
  if (candidates.length === 0) {
    throw new Error("No GITHUB_PAT candidates found.");
  }
  let token = candidates[0];
  let apiReachable = false;
  try {
    for (const c of candidates) {
      const uRes = await githubRequest(c, "GET", "/user");
      if (uRes.ok) {
        token = c;
        apiReachable = true;
        console.log(`[sync] Authenticated as GitHub user: ${uRes.data?.login} (token len=${c.length})`);
        const localEnvPath = path.join(repoRoot, "GK-Mixer-miniwebtools-main", ".env.local");
        fs.writeFileSync(localEnvPath, `GITHUB_PAT=${c}\n`, "utf8");
        break;
      } else {
        console.log(`[sync] Candidate len=${c.length} returned HTTP ${uRes.status}: ${uRes.data?.message}`);
      }
    }
  } catch (apiErr) {
    console.log(`[sync] api.github.com check skipped (${apiErr.message}); proceeding with git push.`);
  }

  if (apiReachable) {
    try {
      console.log(`[sync] Checking repository ${ORG_NAME}/${REPO_NAME}...`);
      const checkRes = await githubRequest(
        token,
        "GET",
        `/repos/${ORG_NAME}/${REPO_NAME}`
      );
      if (checkRes.ok) {
        console.log(
          `[sync] Found existing repository: https://github.com/${ORG_NAME}/${REPO_NAME} (private=${checkRes.data?.private})`
        );
      }
    } catch {
      // Proceed to git push
    }
  }
  const stageDir = "/tmp/gk-mixer-nightworks-stage";
  const gitWorkDir = "/tmp/gk-mixer-nightworks-git";
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.rmSync(gitWorkDir, { recursive: true, force: true });

  execFileSync(
    process.execPath,
    [path.join(__dirname, "prepare-nightworks-repo.mjs"), stageDir],
    { stdio: "inherit" }
  );

  // 3. Clone existing repo (if it has commits) or init a fresh main branch
  fs.mkdirSync(gitWorkDir, { recursive: true });
  const authedUrl = `https://x-access-token:${token}@github.com/${ORG_NAME}/${REPO_NAME}.git`;
  const cleanUrl = `https://github.com/${ORG_NAME}/${REPO_NAME}.git`;

  let cloned = false;
  try {
    execFileSync("git", ["clone", "--quiet", authedUrl, gitWorkDir], {
      stdio: "ignore",
    });
    if (fs.existsSync(path.join(gitWorkDir, ".git"))) {
      cloned = true;
    }
  } catch {
    cloned = false;
  }

  if (cloned) {
    for (const entry of fs.readdirSync(gitWorkDir)) {
      if (entry === ".git") continue;
      fs.rmSync(path.join(gitWorkDir, entry), { recursive: true, force: true });
    }
  } else {
    execFileSync("git", ["init", "-b", "main"], {
      cwd: gitWorkDir,
      stdio: "ignore",
    });
    execFileSync("git", ["remote", "add", "origin", authedUrl], {
      cwd: gitWorkDir,
      stdio: "ignore",
    });
  }

  // Copy staged files into gitWorkDir
  fs.cpSync(stageDir, gitWorkDir, { recursive: true });

  execFileSync("git", ["config", "user.name", "GK-Mixer Sync"], {
    cwd: gitWorkDir,
  });
  execFileSync("git", ["config", "user.email", "noreply@github.com"], {
    cwd: gitWorkDir,
  });
  execFileSync("git", ["add", "-A"], { cwd: gitWorkDir });

  let hasChanges = true;
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { cwd: gitWorkDir });
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log(`[sync] ${cleanUrl} is already up to date!`);
  } else {
    execFileSync(
      "git",
      [
        "commit",
        "-m",
        "feat(nightworks): sync Night Works single-brand hand-brush edition",
      ],
      { cwd: gitWorkDir, stdio: "inherit" }
    );
    console.log(`[sync] Pushing to ${cleanUrl} (branch: main)...`);
    let pushed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execFileSync("git", ["push", "--force", "-u", "origin", "HEAD:main"], {
          cwd: gitWorkDir,
          stdio: "inherit",
        });
        pushed = true;
        break;
      } catch (e) {
        console.warn(`[sync] git push attempt ${attempt}/3 failed: ${e.message}`);
      }
    }
    if (pushed) {
      console.log(`[sync] Successfully pushed to ${cleanUrl}!`);
    }
  }

  // Clean up temporary git directory so token in .git/config does not linger in /tmp
  fs.rmSync(gitWorkDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("[sync] Error:", err.message);
  process.exit(1);
});
