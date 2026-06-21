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
const sceneRoot = path.join(__dirname, "artifacts", "scene-runs");
const approvedAssetTemplates = new Set(["talent-walkthrough-mobile", "talent-onboarding-mobile", "talent-onboarding-desktop"]);

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function requireEnv(name, fallbackName) {
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
    user: session.user,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelFromName(value) {
  return value
    .replace(/^talent-mobile-/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function captionFromName(value) {
  const labels = {
    "talent-mobile-dashboard": "Open the Talent recruiter dashboard and establish the current hiring snapshot.",
    "talent-mobile-role-list": "Move into the role list to show active hiring work.",
    "talent-mobile-role-overview": "Open a role and frame the role-level overview.",
    "talent-mobile-contribution-matrix": "Highlight the contribution matrix for structured candidate review.",
    "talent-mobile-beacon": "Show Beacon as the role intelligence surface.",
    "talent-mobile-shortlist": "Show shortlist review as the decision-making workspace.",
    "talent-mobile-applications": "Finish on applications so the asset covers the full recruiter path.",
    "talent-onboarding-work-email": "Start onboarding with the recruiter work email and company-domain check.",
    "talent-onboarding-about-you": "Collect the recruiter's profile details before creating the workspace.",
    "talent-onboarding-company": "Create the hiring workspace from company details.",
    "talent-onboarding-first-role": "Add the first hiring role so Talent can prepare the workflow.",
    "talent-onboarding-library-match": "Preview how Talent matches roles to the library.",
    "talent-onboarding-review": "Review the first role setup before finishing onboarding.",
  };
  return labels[value] || `Show ${labelFromName(value).toLowerCase()} in Talent.`;
}

function renderSizeForTemplate(assetTemplate) {
  if (assetTemplate.device === "desktop") {
    return {
      width: 1920,
      height: 1080,
    };
  }

  return {
    width: 1080,
    height: 1920,
  };
}

async function readAssetTemplate(assetTemplateSlug) {
  if (!approvedAssetTemplates.has(assetTemplateSlug)) {
    throw new Error(`Template is not approved for walkthrough scene capture: ${assetTemplateSlug}`);
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
  return requireEnv(targetConfig.baseUrlEnv, targetConfig.legacyBaseUrlEnv);
}

async function createTargetSession(assetTemplate) {
  if (assetTemplate.authRequired === false) {
    return null;
  }

  const targetConfig = getTargetConfig(assetTemplate);
  const targetSupabaseUrl = requireEnv(targetConfig.supabaseUrlEnv, targetConfig.fallbackSupabaseUrlEnv);
  const targetSupabaseAnonKey = requireEnv(targetConfig.supabaseAnonKeyEnv, targetConfig.fallbackSupabaseAnonKeyEnv);
  const email = requireEnv(targetConfig.emailEnv, targetConfig.legacyEmailEnv);
  const password = requireEnv(targetConfig.passwordEnv, targetConfig.legacyPasswordEnv);
  const authClient = createClient(targetSupabaseUrl, targetSupabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new Error(`Target demo login failed for ${assetTemplate.app}: ${error?.message || "No session returned"}`);
  }

  return {
    email,
    session: data.session,
    authStorageKey: `sb-${getProjectRef(targetSupabaseUrl)}-auth-token`,
  };
}

async function runStep(page, assetTemplate, step, state) {
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
    return null;
  }

  if (step.type === "assertText") {
    const textMatcher = step.exact === true ? step.text : new RegExp(escapeRegExp(step.text), "i");
    const locator = page.getByText(textMatcher, { exact: step.exact === true }).filter({ visible: true }).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      throw new Error(`Missing required Talent screen text: ${step.text}`);
    }
    await locator.waitFor({ state: "visible", timeout: step.timeout || 8000 });
    return null;
  }

  if (step.type === "wait") {
    await page.waitForTimeout(step.ms || 1000);
    return null;
  }

  if (step.type === "click") {
    const locator = page.locator(step.selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return null;
      throw new Error(`Missing required Talent selector for ${step.name || step.selector}: ${step.selector}`);
    }
    await locator.click({ timeout: step.timeout || 5000 });
    return null;
  }

  if (step.type === "clickText") {
    const locator = page.getByText(step.text, { exact: false }).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return null;
      throw new Error(`Missing required Talent action text: ${step.text}`);
    }
    await locator.click({ timeout: step.timeout || 5000 });
    return null;
  }

  if (step.type === "fill") {
    const locator = page.locator(step.selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      if (step.optional) return null;
      throw new Error(`Missing required Talent field for ${step.selector}`);
    }
    try {
      await locator.fill(step.value || "", { timeout: step.timeout || 5000 });
    } catch (error) {
      if (step.optional) return null;
      throw error;
    }
    return null;
  }

  if (step.type === "rememberRolePath") {
    const pathName = new URL(page.url()).pathname;
    if (!/^\/roles\/[^/]+$/.test(pathName)) {
      throw new Error(`Expected to be on a Talent role detail page, got: ${pathName}`);
    }
    state.rolePath = pathName;
    return null;
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
    return null;
  }

  if (step.type === "screenshot") {
    return { name: step.name || `scene-${state.sceneIndex + 1}` };
  }

  throw new Error(`Unsupported walkthrough step type: ${step.type}`);
}

async function captureScenes(assetTemplateSlug = "talent-walkthrough-mobile") {
  const assetTemplate = await readAssetTemplate(assetTemplateSlug);
  const targetAuth = await createTargetSession(assetTemplate);
  const runId = `${assetTemplateSlug}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runDir = path.join(sceneRoot, runId);
  const screenshotDir = path.join(runDir, "screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const deviceOptions = assetTemplate.device === "mobile" && assetTemplate.deviceProfile
    ? devices[assetTemplate.deviceProfile]
    : null;

  if (assetTemplate.device === "mobile" && !deviceOptions) {
    throw new Error(`Unsupported Playwright device profile: ${assetTemplate.deviceProfile}`);
  }

  const context = await browser.newContext({
    ...(deviceOptions || {}),
    viewport: assetTemplate.device === "mobile"
      ? deviceOptions.viewport
      : assetTemplate.viewport || { width: 1440, height: 900 },
  });

  if (targetAuth) {
    await context.addInitScript(
      ({ authStorageKey: storageKey, session, email }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(session));
        window.localStorage.setItem("walkthroughUserEmail", email);
      },
      {
        authStorageKey: targetAuth.authStorageKey,
        session: buildAuthStorageValue(targetAuth.session),
        email: targetAuth.email,
      },
    );
  }

  const page = await context.newPage();
  const state = { rolePath: null, sceneIndex: 0 };
  const scenes = [];

  try {
    for (const step of assetTemplate.steps || []) {
      const scene = await runStep(page, assetTemplate, step, state);
      if (!scene) continue;

      const fileName = `${String(state.sceneIndex + 1).padStart(2, "0")}-${scene.name}.png`;
      const screenshotPath = path.join(screenshotDir, fileName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      scenes.push({
        id: scene.name,
        title: labelFromName(scene.name),
        caption: captionFromName(scene.name),
        sourceUrl: page.url(),
        image: path.relative(runDir, screenshotPath).replace(/\\/g, "/"),
        durationSeconds: 5,
      });
      state.sceneIndex += 1;
      console.log(`[scene-capture] Captured ${scene.name}`);
    }
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const manifest = {
    id: runId,
    assetTemplateSlug,
    app: assetTemplate.app,
    name: assetTemplate.name,
    description: assetTemplate.description,
    device: assetTemplate.device,
    deviceProfile: assetTemplate.deviceProfile || null,
    createdAt: new Date().toISOString(),
    render: {
      fps: 30,
      ...renderSizeForTemplate(assetTemplate),
      defaultSceneDurationSeconds: 5,
    },
    scenes,
  };

  const manifestPath = path.join(runDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[scene-capture] Wrote manifest ${manifestPath}`);
  console.log(`[scene-capture] Captured ${scenes.length} scenes in ${runDir}`);
  return { runDir, manifestPath, sceneCount: scenes.length };
}

const assetTemplateSlug = process.argv[2] || "talent-walkthrough-mobile";
captureScenes(assetTemplateSlug).catch((error) => {
  console.error("[scene-capture] Failed:", error.message);
  process.exit(1);
});
