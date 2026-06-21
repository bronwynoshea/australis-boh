# BOH Walkthrough Recorder

Dev/staging-only Playwright worker for generating private walkthrough video assets.

The BOH browser UI creates a queued run through Supabase Edge Functions. This worker processes queued runs, follows a saved asset template, uploads private artifacts to Supabase Storage, and updates the run status.

Screenshot-scene capture is now the preferred path for production-quality assets. A screenshot-scene run captures stable scene screenshots and a render manifest first; Remotion can then use those assets to compose the final polished video. The legacy live recording path is still available with `capture_mode = screen_recording`, but it is no longer the default because raw mobile recordings can show unpolished navigation flashes.

Voiceover is modeled as a render input, not a Playwright recording feature. Forge can store no voiceover, transcript-only text, or voiceover-ready transcript text with the run. A later text-to-speech step can create an audio file, and Remotion can combine that audio with screenshots, captions, and timing.

## Control plane vs capture target

BOH is the control plane: it owns asset templates, run records, status, private storage, and Forge UI. The capture target is the app being opened by Playwright.

Those can be different environments. During development, BOH dev can control recordings of Talent/jobzcafe-dev, the jobseeker product dev app, or BOH dev itself. Later, production Forge can still control recordings against approved dev/staging targets so release videos are generated from unreleased code before production rollout.

Target apps are configured in `tools/walkthrough-recorder/targets.mjs`. Asset templates choose a target with their `app` key:

- `boh` for internal BOH walkthroughs.
- `talent` for the recruiter/Talent target app.
- `jobzcafe` for the external jobseeker product.

Current local asset templates:

- `talent-onboarding-mobile` captures the dev-only Talent onboarding preview on `JOBZCAFE_DEV_URL`, with `authRequired: false`.
- `talent-walkthrough-mobile` captures an authenticated Talent recruiter workflow.

Required environment variables:

- `CONTROL_SUPABASE_URL` or `SUPABASE_URL`
- `WALKTHROUGH_RUNNER_TOKEN`
- For BOH capture:
  - `BOH_DEV_URL`
  - `BOH_TARGET_DEV_SUPABASE_URL` or `CONTROL_SUPABASE_URL`
  - `BOH_TARGET_DEV_SUPABASE_ANON_KEY` or `CONTROL_SUPABASE_ANON_KEY`
  - `BOH_WALKTHROUGH_EMAIL`
  - `BOH_WALKTHROUGH_PASSWORD`
- For Talent/recruiter capture:
  - `JOBZCAFE_DEV_URL`
  - `TARGET_DEV_SUPABASE_URL`
  - `TARGET_DEV_SUPABASE_ANON_KEY`
  - `TARGET_WALKTHROUGH_EMAIL`
  - `TARGET_WALKTHROUGH_PASSWORD`
- For jobseeker product capture:
  - `JOBZCAFE_JOBSEEKER_DEV_URL`
  - `JOBZCAFE_JOBSEEKER_DEV_SUPABASE_URL`
  - `JOBZCAFE_JOBSEEKER_DEV_SUPABASE_ANON_KEY`
  - `JOBZCAFE_JOBSEEKER_WALKTHROUGH_EMAIL`
  - `JOBZCAFE_JOBSEEKER_WALKTHROUGH_PASSWORD`

Run one queued job:

```powershell
npm run walkthrough:worker
```

For a queued run with `capture_mode = screenshot_scenes`, the worker uploads:

- screenshot artifacts for each captured scene
- a trace zip
- a `manifest` JSON artifact for the render stage

For a queued run with `capture_mode = screen_recording`, the worker also uploads the raw WebM video artifact.

Capture screenshot scenes for the Remotion-style pipeline prototype:

```powershell
node tools/walkthrough-recorder/capture-scenes.mjs talent-walkthrough-mobile
```

This script is intentionally not called from the browser.
