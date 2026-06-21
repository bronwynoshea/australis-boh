#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const artifactsRoot = path.resolve("tools/walkthrough-recorder/artifacts/scene-runs");
const defaultBrowserExecutable = process.platform === "win32"
  ? "C:\\Users\\boshe\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe"
  : undefined;
const defaultBinariesDirectory = process.platform === "win32"
  ? path.resolve("node_modules/@remotion/compositor-win32-x64-msvc")
  : undefined;

async function latestSceneRun() {
  const entries = await fs.readdir(artifactsRoot, { withFileTypes: true });
  const dirs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const fullPath = path.join(artifactsRoot, entry.name);
        const stat = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      }),
  );

  dirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dirs[0]?.fullPath;
}

async function buildInputProps(sceneRunPath) {
  const manifestPath = path.join(sceneRunPath, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const scenes = await Promise.all((manifest.scenes || []).map(async (scene) => {
    const imagePath = path.join(sceneRunPath, scene.image);
    const imageBase64 = await fs.readFile(imagePath, "base64");

    return {
      ...scene,
      imageUrl: `data:image/png;base64,${imageBase64}`,
      durationSeconds: Number(scene.durationSeconds) || Number(manifest.render?.defaultSceneDurationSeconds) || 5,
    };
  }));

  if (scenes.length === 0) {
    throw new Error("Manifest has no scenes.");
  }

  return {
    manifest,
    inputProps: {
      scenes,
      device: manifest.device,
    },
  };
}

async function main() {
  const sceneRunPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : await latestSceneRun();

  if (!sceneRunPath) {
    throw new Error("No scene run found.");
  }

  const { manifest, inputProps } = await buildInputProps(sceneRunPath);
  const entryPoint = path.resolve("tools/walkthrough-recorder/remotion/index.jsx");
  const outputLocation = path.join(sceneRunPath, `${manifest.assetTemplateSlug || "walkthrough"}-remotion.mp4`);
  const totalDuration = inputProps.scenes.reduce(
    (sum, scene) => sum + Math.round((scene.durationSeconds || 5) * 30),
    0,
  );

  const serveUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "WalkthroughVideo",
    inputProps,
    ...(process.env.REMOTION_BROWSER_EXECUTABLE || defaultBrowserExecutable
      ? { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || defaultBrowserExecutable }
      : {}),
    ...(process.env.REMOTION_BINARIES_DIRECTORY || defaultBinariesDirectory
      ? { binariesDirectory: process.env.REMOTION_BINARIES_DIRECTORY || defaultBinariesDirectory }
      : {}),
  });

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalDuration,
      fps: Number(manifest.render?.fps) || composition.fps,
      width: Number(manifest.render?.width) || composition.width,
      height: Number(manifest.render?.height) || composition.height,
    },
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    ...(process.env.REMOTION_BROWSER_EXECUTABLE || defaultBrowserExecutable
      ? { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || defaultBrowserExecutable }
      : {}),
    ...(process.env.REMOTION_BINARIES_DIRECTORY || defaultBinariesDirectory
      ? { binariesDirectory: process.env.REMOTION_BINARIES_DIRECTORY || defaultBinariesDirectory }
      : {}),
  });

  console.log(outputLocation);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
