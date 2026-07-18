import assert from "node:assert/strict";
import test from "node:test";
import { createHtmlStarter } from "./generateStarter.ts";

test("creates a bounded polished HTML starter from an instruction", () => {
  const html = createHtmlStarter("Launch page for Acme <Growth> with a clear demo call to action");

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Acme &lt;Growth&gt;/);
  assert.match(html, /Book a demo/);
  assert.match(html, /@media \(max-width: 720px\)/);
  assert.doesNotMatch(html, /<script/i);
});

test("uses a useful default when the instruction is blank", () => {
  const html = createHtmlStarter("   ");

  assert.match(html, /A focused page for your next campaign/);
  assert.match(html, /Start here/);
});
