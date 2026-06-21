import { chromium, devices } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getTargetConfig as getRegisteredTargetConfig } from "./targets.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const assetTemplateDir = path.join(__dirname, "asset-templates");
const artifactRoot = path.join(__dirname, "artifacts");
const videoDir = path.join(artifactRoot, "videos");
const screenshotDir = path.join(artifactRoot, "screenshots");
const traceDir = path.join(artifactRoot, "traces");
const approvedAssetTemplates = new Set(["talent-walkthrough-mobile", "talent-onboarding-mobile", "talent-onboarding-desktop"]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function requireNamedEnv(name, fallbackName) {
  const value = getEnv(name, fallbackName);
  if (!value) {
    const suffix = fallbackName ? ` or ${fallbackName}` : "";
    throw new Error(`Missing required environment variable: ${name}${suffix}`);
  }
  return value;
}

function getProjectRef(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  return hostname.split(".")[0];
}

function buildAuthStorageValue(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user
  };
}

function getControlSupabaseUrl() {
  return requireNamedEnv("CONTROL_SUPABASE_URL", "SUPABASE_URL");
}

function getWorkerUrl() {
  return `${getControlSupabaseUrl().replace(/\/$/, "")}/functions/v1/forge-walkthrough-worker`;
}

async function callWorker(action, payload = {}) {
  const response = await fetch(getWorkerUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("WALKTHROUGH_RUNNER_TOKEN")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, ...payload })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Walkthrough worker action failed: ${action}`);
  }

  return data;
}

async function readAssetTemplate(assetTemplateSlug) {
  if (!approvedAssetTemplates.has(assetTemplateSlug)) {
    throw new Error(`Template is not approved for walkthrough recording: ${assetTemplateSlug}`);
  }

  const assetTemplatePath = path.join(assetTemplateDir, `${assetTemplateSlug}.json`);
  const content = await fs.readFile(assetTemplatePath, "utf8");
  return JSON.parse(content);
}

function getTargetConfig(assetTemplate) {
  const appKey = assetTemplate.app || assetTemplate.appKey;
  const targetConfig = getRegisteredTargetConfig(appKey);
  if (!targetConfig) {
    throw new Error(`No approved target environment is configured for walkthrough app: ${appKey || "unknown"}`);
  }
  return targetConfig;
}

function getTargetBaseUrl(assetTemplate) {
  const targetConfig = getTargetConfig(assetTemplate);
  if (assetTemplate.baseUrlEnv !== targetConfig.baseUrlEnv && assetTemplate.baseUrlEnv !== targetConfig.legacyBaseUrlEnv) {
    throw new Error("Walkthrough template uses an unapproved target base URL");
  }
  return requireNamedEnv(targetConfig.baseUrlEnv, targetConfig.legacyBaseUrlEnv);
}

async function createTargetSession(assetTemplate) {
  if (assetTemplate.authRequired === false) {
    return null;
  }

  const targetConfig = getTargetConfig(assetTemplate);
  const targetSupabaseUrl = requireNamedEnv(targetConfig.supabaseUrlEnv, targetConfig.fallbackSupabaseUrlEnv);
  const targetSupabaseAnonKey = requireNamedEnv(targetConfig.supabaseAnonKeyEnv, targetConfig.fallbackSupabaseAnonKeyEnv);
  const email = requireNamedEnv(targetConfig.emailEnv, targetConfig.legacyEmailEnv);
  const password = requireNamedEnv(targetConfig.passwordEnv, targetConfig.legacyPasswordEnv);
  const authClient = createClient(targetSupabaseUrl, targetSupabaseAnonKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new Error(`Target demo login failed for ${assetTemplate.app}: ${error?.message || "No session returned"}`);
  }

  return {
    email,
    session: data.session,
    authStorageKey: `sb-${getProjectRef(targetSupabaseUrl)}-auth-token`
  };
}

async function uploadArtifact(runId, localPath, artifactType, mimeType) {
  const fileBytes = await fs.readFile(localPath);
  await callWorker("upload-artifact", {
    runId,
    artifactType,
    fileName: path.basename(localPath),
    mimeType,
    contentBase64: Buffer.from(fileBytes).toString("base64")
  });
}

function normalizeCaptureMode(run) {
  return (run.capture_mode || run.captureMode || "screen_recording").replace(/-/g, "_");
}

function describeStep(step) {
  return step.name || step.text || step.selector || step.type;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runStep(page, assetTemplate, step, runId, state) {
  if (step.type === "goto") {
    const baseUrl = getTargetBaseUrl(assetTemplate);
    const pathValue = step.path || assetTemplate.startPath || "/";

    if (/^https?:\/\//i.test(pathValue)) {
      throw new Error("Absolute walkthrough URLs are not allowed");
    }

    const targetUrl = new URL(pathValue, baseUrl);
    const allowedOrigin = new URL(baseUrl).origin;

    if (targetUrl.origin !== allowedOrigin) {
      throw new Error("Walkthrough navigation target is outside the approved target dev origin");
    }

    await page.goto(targetUrl.toString(), { waitUntil: step.waitUntil || "networkidle" });
    return;
  }

  if (step.type === "assertText") {
    const textMatcher = step.exact === true
      ? step.text
      : new RegExp(escapeRegExp(step.text), "i");
    const locator = page.getByText(textMatcher, { exact: step.exact === true }).filter({ visible: true }).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      throw new Error(`Missing required Talent screen text: ${step.text}`);
    }
    await locator.waitFor({ state: "visible", timeout: step.timeout || 8000 });
    return;
  }

  if (step.type === "wait") {
    await page.waitForTimeout(step.ms || 1000);
    return;
  }

  if (step.type === "clickText") {
    const locator = page.getByText(step.text, { exact: false }).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return;
      throw new Error(`Missing required Talent action text: ${step.text}`);
    }
    await locator.click({ timeout: step.timeout || 5000 });
    return;
  }

  if (step.type === "fill") {
    const locator = page.locator(step.selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return;
      throw new Error(`Missing required Talent field for ${describeStep(step)}: ${step.selector}`);
    }
    await locator.fill(step.value || "", { timeout: step.timeout || 5000 });
    return;
  }

  if (step.type === "click") {
    const locator = page.locator(step.selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return;
      throw new Error(`Missing required Talent selector for ${describeStep(step)}: ${step.selector}`);
    }
    await locator.click({ timeout: step.timeout || 5000 });
    return;
  }

  if (step.type === "rememberRolePath") {
    const pathName = new URL(page.url()).pathname;
    if (!/^\/roles\/[^/]+$/.test(pathName)) {
      throw new Error(`Expected to be on a Talent role detail page, got: ${pathName}`);
    }
    state.rolePath = pathName;
    return;
  }

  if (step.type === "gotoRememberedRoleSubpath") {
    if (!state.rolePath) {
      throw new Error("No Talent role path has been captured for this walkthrough");
    }

    const allowedSuffixes = new Set(["", "/matrix", "/shortlist", "/applications", "/beacon"]);
    const suffix = step.suffix || "";
    if (!allowedSuffixes.has(suffix)) {
      throw new Error(`Unapproved Talent role subpath: ${suffix}`);
    }

    const baseUrl = getTargetBaseUrl(assetTemplate);
    const targetUrl = new URL(`${state.rolePath}${suffix}`, baseUrl);
    const allowedOrigin = new URL(baseUrl).origin;
    if (targetUrl.origin !== allowedOrigin) {
      throw new Error("Walkthrough navigation target is outside Talent dev");
    }

    await page.goto(targetUrl.toString(), { waitUntil: step.waitUntil || "networkidle" });
    return;
  }

  if (step.type === "screenshot") {
    const fileName = `${runId}-${step.name || "step"}.png`;
    await page.screenshot({
      path: path.join(screenshotDir, fileName),
      fullPage: true
    });
    return;
  }

  throw new Error(`Unsupported walkthrough step type: ${step.type}`);
}

async function recordRun(run) {
  const assetTemplateRef = run.assetTemplate || run.recipe;
  if (!assetTemplateRef?.slug) {
    throw new Error("Claimed run did not include an asset template");
  }

  const assetTemplate = await readAssetTemplate(assetTemplateRef.slug);
  const captureMode = normalizeCaptureMode(run);
  const recordsLiveVideo = captureMode === "screen_recording";

  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(traceDir, { recursive: true });

  const targetAuth = await createTargetSession(assetTemplate);

  const videoOutputDir = path.join(videoDir, run.id);
  await fs.mkdir(videoOutputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const deviceOptions = assetTemplate.device === "mobile" && assetTemplate.deviceProfile
    ? devices[assetTemplate.deviceProfile]
    : null;

  if (assetTemplate.device === "mobile" && !deviceOptions) {
    throw new Error(`Unsupported Playwright device profile: ${assetTemplate.deviceProfile}`);
  }

  const contextOptions = {
    ...(deviceOptions || {}),
    viewport: assetTemplate.device === "mobile"
      ? deviceOptions.viewport
      : assetTemplate.viewport || { width: 1440, height: 900 },
  };

  if (recordsLiveVideo) {
    contextOptions.recordVideo = {
      dir: videoOutputDir,
      size: assetTemplate.device === "mobile"
        ? deviceOptions.viewport
        : assetTemplate.viewport || { width: 1440, height: 900 }
    };
  }

  const context = await browser.newContext(contextOptions);

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  if (targetAuth) {
    await context.addInitScript(
      ({ authStorageKey: storageKey, session, email }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(session));
        window.localStorage.setItem("walkthroughUserEmail", email);
      },
      {
        authStorageKey: targetAuth.authStorageKey,
        session: buildAuthStorageValue(targetAuth.session),
        email: targetAuth.email
      }
    );
  }

  const page = await context.newPage();
  let videoPath = null;

  try {
    const state = {};
    for (const step of assetTemplate.steps || []) {
      await runStep(page, assetTemplate, step, run.id, state);
    }

    const tracePath = path.join(traceDir, `${run.id}.zip`);
    await context.tracing.stop({ path: tracePath });
    videoPath = recordsLiveVideo ? await page.video()?.path() : null;
    await page.close();
    await context.close();
    await browser.close();

    if (recordsLiveVideo && !videoPath) {
      throw new Error("Playwright did not produce a video file");
    }

    if (recordsLiveVideo) {
      await uploadArtifact(run.id, videoPath, "video", "video/webm");
    }

    await uploadArtifact(run.id, tracePath, "trace", "application/zip");

    const screenshots = await fs.readdir(screenshotDir);
    const sceneScreenshots = screenshots.filter((name) => name.startsWith(`${run.id}-`));
    for (const screenshot of sceneScreenshots) {
      await uploadArtifact(
        run.id,
        path.join(screenshotDir, screenshot),
        "screenshot",
        "image/png"
      );
    }

    if (!recordsLiveVideo) {
      const manifestPath = path.join(traceDir, `${run.id}-manifest.json`);
      const manifest = {
        runId: run.id,
        assetTemplateSlug: assetTemplateRef.slug,
        captureMode,
        renderMode: run.render_mode || run.renderMode || "remotion",
        voiceoverMode: run.voiceover_mode || run.voiceoverMode || "none",
        transcriptText: run.transcript_text || run.transcriptText || null,
        requestedStepPlan: run.step_plan || run.stepPlan || null,
        app: assetTemplate.app,
        name: assetTemplate.name,
        device: assetTemplate.device,
        deviceProfile: assetTemplate.deviceProfile || null,
        createdAt: new Date().toISOString(),
        scenes: sceneScreenshots.map((fileName, index) => ({
          index: index + 1,
          fileName,
          caption: fileName
            .replace(`${run.id}-`, "")
            .replace(/\.png$/i, "")
            .replace(/-/g, " "),
        })),
      };
      await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await uploadArtifact(run.id, manifestPath, "manifest", "application/json");
    }

    await callWorker("complete", { runId: run.id });
  } catch (error) {
    await context.tracing.stop().catch(() => undefined);
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw error;
  }
}

async function main() {
  getControlSupabaseUrl();
  requireEnv("WALKTHROUGH_RUNNER_TOKEN");

  const { run } = await callWorker("claim");
  if (!run) {
    console.log("[walkthrough-recorder] No queued runs found");
    return;
  }

  const assetTemplateRef = run.assetTemplate || run.recipe;
  console.log(`[walkthrough-recorder] Claimed run ${run.id} for ${assetTemplateRef?.slug || "unknown template"} (${normalizeCaptureMode(run)})`);

  try {
    await recordRun(run);
    console.log(`[walkthrough-recorder] Completed run ${run.id}`);
  } catch (error) {
    console.error(`[walkthrough-recorder] Failed run ${run.id}:`, error.message);
    await callWorker("fail", {
      runId: run.id,
      errorMessage: error.message
    }).catch((failError) => {
      console.error("[walkthrough-recorder] Failed to mark run failed:", failError.message);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[walkthrough-recorder] Fatal error:", error);
  process.exit(1);
});
