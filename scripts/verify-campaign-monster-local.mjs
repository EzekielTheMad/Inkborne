import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
// Builtins only: cooperative stop is installed before expensive source closure.
let stopRequested = false, closeRuntime = () => {};
const earlyDeadline = Number(process.argv[process.argv.indexOf("--shared-deadline") + 1]);
process.on("message", message => { if (message?.type === "stop") { stopRequested = true; closeRuntime(); } });
process.once("disconnect", () => { stopRequested = true; closeRuntime(); });
async function checkpoint(label, reserve = 0) {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopRequested, false, "Cooperative stop before " + label);
  assert.ok(Number.isSafeInteger(earlyDeadline) && earlyDeadline - Date.now() >= reserve, "Shared deadline/reservation before " + label);
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (root, args) => execFileSync("git", ["-C", root, ...args], { windowsHide: true });
async function bootstrap(root) {
  const file = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR, digest = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
  assert.ok(file && path.isAbsolute(file)); assert.match(digest ?? "", /^[a-f0-9]{64}$/);
  const bytes = await fs.readFile(file); assert.equal(hash(bytes), digest);
  const input = JSON.parse(bytes); assert.equal(input.kind, "independently-reviewed-offline-m5-v1");
  assert.equal(input.producerCheckpoint, "0aec1242c911bc35f92ba413fd37f483b6b83f03");
  assert.deepEqual(input.nodeRuntime, { executable: process.execPath, version: process.version, executedSha256: hash(await fs.readFile(process.execPath)) });
  assert.match(input.harnessCheckpoint, /^[a-f0-9]{40}$/);
  const own = ["e2e/local-campaign-monster/fixture.tsx", "e2e/local-campaign-monster/playwright.config.ts", "e2e/local-campaign-monster/campaign-monster.spec.mts",
    "scripts/campaign-monster-production-inputs.mjs", "scripts/campaign-monster-scenarios.mjs", "scripts/verify-campaign-monster-local.mjs"];
  assert.deepEqual(Object.keys(input.harnessBlobs).sort(), own.sort());
  const helpers = { "scripts/passive-feature-production-assets.mjs": "e4058f8a31cd911583a312e59fedcf4c3fd4adae", "scripts/npc-process.mjs": "0841bda7b9e785280e684030bf4fe900d81465e5" };
  const upstream = path.resolve(root, "../equipment-verification"); assert.equal(git(upstream, ["rev-parse", "HEAD"]).toString().trim(), input.rootSourceSha);
  const proof = [];
  for (const relative of [...own, ...Object.keys(helpers)]) {
    await checkpoint("bootstrap " + relative);
    const expected = helpers[relative] ?? input.harnessBlobs[relative];
    if (!helpers[relative]) assert.equal(git(root, ["rev-parse", input.harnessCheckpoint + ":" + relative]).toString().trim(), expected);
    let rawHash, representation;
    for (const checkout of [root, upstream]) {
      for (const args of [["diff", "--cached", "HEAD", "--", relative], ["diff", "--", relative], ["ls-files", "--unmerged", "--", relative]])
        assert.equal(git(checkout, args).toString().trim(), "");
      assert.equal(git(checkout, ["rev-parse", "HEAD:" + relative]).toString().trim(), expected);
      assert.equal(git(checkout, ["rev-parse", ":" + relative]).toString().trim(), expected);
      const attributes = git(checkout, ["check-attr", "text", "eol", "filter", "working-tree-encoding", "ident", "--", relative]).toString();
      assert.ok(attributes.includes(relative + ": filter: unspecified")); assert.ok(attributes.includes(relative + ": working-tree-encoding: unspecified"));
      const config = {};
      for (const key of ["core.autocrlf", "core.eol", "core.safecrlf", "core.attributesfile"]) {
        try { config[key] = git(checkout, ["config", "--show-origin", "--get", key]).toString().trim(); }
        catch (error) { if (error.status !== 1) throw error; config[key] = null; }
      }
      const current = { attributes, config }; if (representation) assert.deepEqual(current, representation); representation = current;
      const actual = hash(await fs.readFile(path.join(checkout, relative)));
      assert.equal(actual, hash(git(checkout, ["cat-file", "--filters", "--path=" + relative, expected])));
      if (rawHash) assert.equal(actual, rawHash); rawHash = actual;
    }
    proof.push({ relative, gitBlob: expected, executedSha256: rawHash, representation });
  }
  return { descriptorSha256: digest, proof };
}
import http from "node:http";
import net from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
const startedAt = Date.now(), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await checkpoint("bootstrap entry");
const boot = await bootstrap(root); // BEFORE every project/helper/package dynamic import.
await checkpoint("owned binder import");
const inputs = await import("./campaign-monster-production-inputs.mjs");
const descriptor = await inputs.reviewedDescriptor(root), phases = await inputs.requireMeasuredBudget(descriptor);
const deadlineIndex = process.argv.indexOf("--shared-deadline");
assert.ok(deadlineIndex >= 0); const deadline = Number(process.argv[deadlineIndex + 1]);
const gateStartedAt = Number(process.env.INKBORNE_M5_GATE_STARTED_AT);
assert.ok(Number.isSafeInteger(gateStartedAt) && gateStartedAt > 0 && gateStartedAt <= startedAt);
assert.ok(Number.isSafeInteger(deadline) && deadline > Date.now() && deadline === gateStartedAt + 900000 && deadline <= startedAt + 900000);
const timing = [];
function remaining(label, minimum) { assert.ok(deadline - Date.now() >= minimum, "Shared budget cannot cover " + label); }
remaining("remaining entry/cases/finals/cleanup", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
await checkpoint("entry proof", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
const entry = await inputs.measureGuard("entry", () => inputs.verifyCampaignMonsterEntry(root), record => timing.push(record));
const processes = await inputs.loadCampaignMonsterProcess(root, entry);
await checkpoint("owned process observation", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
processes.assertNoOtherRunner(fileURLToPath(import.meta.url), process.pid);
const output = path.join(root, "test-results/campaign-monster-local/run-" + Date.now());
await fs.mkdir(output, { recursive: true });
process.send?.({ type: "output", path: output });
const taskProcess = { ...await processes.freshIdentity(process.pid, process.ppid), cwd: root, startUtc: new Date().toISOString(), port: null };
const resourcesBefore = processes.resources();
await checkpoint("assets", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
const production = await inputs.measureGuard("assets", () => inputs.loadCampaignMonsterProductionAssets(root, descriptor.buildManifestPath, processes.receipt), record => timing.push(record));
const { build } = await import("esbuild");
const { chromium } = await import("playwright");
await checkpoint("bundles", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
const captured = new Map(), modelCaptured = new Map();
const boundaryPlugin = { name: "declared-m5-model-boundaries", setup(builder) {
  builder.onResolve({ filter: /^(next\/|@\/app\/|server-model$|server-only$|@\/lib\/supabase\/server$)/ }, args => {
    if (args.path === "next/dist/client/components/unstable-rethrow.browser.js") return;
    assert.ok(Object.hasOwn(inputs.boundarySources, args.path), "Live or unknown boundary refused " + args.path);
    return { path: args.path, namespace: "campaign-monster-offline" };
  });
  builder.onLoad({ filter: /.*/, namespace: "campaign-monster-offline" }, args => {
    const contents = inputs.boundarySources[args.path], record = { sha256: hash(contents), bytes: Buffer.byteLength(contents) };
    (args.path === "server-model" ? modelCaptured : captured).set("campaign-monster-offline:" + args.path, record);
    return { loader: "js", contents, resolveDir: root };
  });
} };
const modelPath = path.join(output, "server-model.mjs");
const nodeBundle = await build({ entryPoints: ["server-model"], absWorkingDir: root, outfile: modelPath, bundle: true, platform: "node", format: "esm", metafile: true,
  plugins: [inputs.campaignMonsterProjectInputPlugin(root, modelCaptured), boundaryPlugin] });
const modelBundle = { outputPath: modelPath, outputSha256: hash(await fs.readFile(modelPath)), metafile: nodeBundle.metafile, captured: [...modelCaptured].sort(([a], [b]) => a.localeCompare(b)) };
modelBundle.inputs = await inputs.bindCampaignMonsterProjectInputs(root, nodeBundle.metafile, modelCaptured, production.artifacts, ["tests/fixtures/campaign-monster-instances.ts"]);
await checkpoint("modeled schema import", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
assert.equal(hash(await fs.readFile(modelPath)), modelBundle.outputSha256);
const model = await import(pathToFileURL(modelPath).href); // Actual captured schemas/original fixture; MODELED ledger only.
const bundlePath = path.join(output, "fixture.js");
const browserBundle = await build({ entryPoints: [path.join(root, "e2e/local-campaign-monster/fixture.tsx")], absWorkingDir: root, outfile: bundlePath,
  bundle: true, platform: "browser", jsx: "automatic", metafile: true, define: { "process.env.NODE_ENV": '"production"' },
  plugins: [inputs.campaignMonsterProjectInputPlugin(root, captured), boundaryPlugin] });
assert.ok(!Object.keys(browserBundle.metafile.outputs).some(file => file.endsWith(".css")), "Fixture CSS refused");
const fixtureBytes = Buffer.from(await fs.readFile(bundlePath));
assert.ok(fixtureBytes.length > 0 && fixtureBytes.length <= 16_777_216);
const fixtureBundle = { outputPath: bundlePath, outputSha256: hash(fixtureBytes), outputBytes: fixtureBytes.length };
Object.assign(production.artifacts, await inputs.bindCampaignMonsterProjectInputs(root, browserBundle.metafile, captured, production.artifacts), { modelBundle });
production.artifacts.fixtureBundle = fixtureBundle;
const renderedProof = { artifacts: production.artifacts, metafile: browserBundle.metafile, captured: [...captured].sort(([a], [b]) => a.localeCompare(b)), modelBundle, fixtureBundle };
await fs.writeFile(path.join(output, "rendered-inputs.json"), JSON.stringify(renderedProof, null, 2), { flag: "wx" });
process.send?.({ type: "rendered-inputs", proof: renderedProof });
let state;
function configure(spec = {}) {
  const oldReceipts = state?.receipts;
  state = { role: "owner", initial: false, detail: model.monsterDetail(), mode: "normal", rows: [], receipts: new Map(), calls: [], sourceVersion: 1, ...spec };
  if (spec.retainReceipts && oldReceipts) state.receipts = oldReceipts;
  if (spec.receiptOverrides) state.receipts = new Map(spec.receiptOverrides); // Explicit malformed server-read models only.
}
configure();
function props(url) {
  const base = { campaignId: model.MC.campaign, ownerId: model.MC.owner, systemId: model.MC.system, role: state.role, rows: state.rows, generation: "create",
    sources: state.sources ?? [{ id: model.MC.source, name: "Mossglass Sentinel", version: state.sourceVersion }] };
  if (state.role !== "owner") return { role: state.role, rows: [], generation: "nonowner" }; // No DM props sent.
  const route = /^\/campaigns\/([^/]+)\/monsters\/([^/]+)$/.exec(url.pathname);
  const canonicalUuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  const editValues = url.searchParams.getAll("editAfter"), editAfter = editValues[0];
  if ((url.pathname !== "/fixture" && (!route || !canonicalUuid(route[1]) || !canonicalUuid(route[2]) || route[1] !== model.MC.campaign))
    || editValues.length > 1 || (editValues.length === 1 && !canonicalUuid(editAfter))
    || [...url.searchParams.keys()].some(key => key !== "editAfter")) return { ...base, unavailable: "Modeled route identity is unavailable.", generation: "unavailable" };
  if (state.unavailable) return { ...base, unavailable: state.unavailable };
  try {
    assert.ok(Array.isArray(base.rows) && base.rows.length <= 20);
    base.rows = base.rows.map(raw => model.instanceSummarySchema.parse(raw));
    assert.ok(base.rows.every(row => row.campaign_id === model.MC.campaign));
  } catch { return { ...base, rows: [], unavailable: "Modeled roster read is unavailable." }; }
  if (url.pathname !== "/fixture" || state.initial) {
    if (editAfter) {
      state.calls.push({ kind: "route-resolve", operation: editAfter });
      const saved = state.receipts.get(editAfter);
      try {
        if (!saved) throw Error("No accepted operation");
        const response = model.parseInstanceActionResponse({ status: "saved", receipt: saved }, model.MC.campaign, editAfter);
        if (response.receipt.instance_id !== (route?.[2] ?? model.MC.instance) || BigInt(state.detail.revision) < BigInt(response.receipt.readback.revision)) throw Error("Latest revision unavailable");
      } catch { return { ...base, unavailable: "Modeled latest editor is unavailable.", generation: "unavailable" }; }
    }
    state.calls.push({ kind: "route-detail" });
    try {
      const detail = model.instanceDetailSchema.parse(state.detail);
      if (detail.id !== (route?.[2] ?? model.MC.instance) || detail.campaign_id !== (route?.[1] ?? model.MC.campaign) || detail.system_id !== model.MC.system) throw Error("Modeled detail/route identity mismatch");
      const checked = model.admittedMonsterSnapshot(detail.source_snapshot, detail.system_id, detail.source_content_id, detail.source_version);
      if (checked.data.hit_points.average !== detail.declared_max_hp) throw Error("HP mismatch");
      return { ...base, initial: detail, generation: model.MC.owner + ":" + model.MC.campaign + ":" + detail.id + ":" + (editAfter ?? "initial") };
    } catch { return { ...base, unavailable: "Unsupported modeled immutable source.", generation: "unavailable" }; }
  }
  return base;
}
function action(kind, data) {
  if (kind === "control") { configure(data); return { configured: true }; }
  if (kind === "inspect") return { detail: state.role === "owner" ? state.detail : null, calls: state.calls, receipts: state.role === "owner" ? [...state.receipts.values()] : [] };
  state.calls.push({ kind, data });
  if (state.role !== "owner" || data.campaign !== model.MC.campaign) return { status: "error", message: "Modeled owner boundary refused." };
  if (kind === "preview") return { status: "preview", preview: model.monsterPreview() };
  if (kind === "resolve") return state.receipts.has(data.operation) ? { status: "saved", receipt: state.receipts.get(data.operation) } : { status: "absent" };
  if (kind !== "commit") throw Error("Unknown modeled endpoint");
  const request = model.instanceRequestSchema.parse(data.intent);
  const existing = state.receipts.get(request.operation_id);
  if (existing) return model.sameInstanceIntent(existing.canonical_intent, request) ? { status: "saved", receipt: existing } : { status: "conflict", message: "Changed modeled intent." };
  if (["lost", "settlement-uncertain"].includes(data.mode)) return { status: "uncertain", message: "Modeled response unavailable." };
  if (data.mode === "settlement-refusal") return { status: "error", message: "Definite modeled prewrite refusal." };
  if (data.mode === "malformed") return undefined;
  let receipt;
  if (request.command === "create") receipt = model.monsterReceipt(request);
  else {
    if (request.instance_id !== state.detail.id || request.expected_revision !== state.detail.revision) return { status: "conflict", message: "Modeled CAS conflict." };
    const changed = Object.entries(request.patch).some(([key, value]) => state.detail[key] !== value);
    const detail = { ...state.detail, ...request.patch, revision: (BigInt(state.detail.revision) + (changed ? 1n : 0n)).toString() };
    receipt = { ...model.monsterReceipt(request), outcome: changed ? "updated" : "noop",
      readback: Object.fromEntries(["id", "campaign_id", "name", "current_hp", "declared_max_hp", "archived", "revision", "notes"].map(key => [key, detail[key]])) };
  }
  if (data.mode === "historical-actor") receipt.original_actor_id = model.MC.foreign;
  receipt = model.instanceReceiptSchema.parse(receipt);
  state.detail = { ...state.detail, ...receipt.readback }; state.receipts.set(request.operation_id, receipt);
  if (data.mode === "wrong-tuple") return { status: "saved", receipt: { ...receipt, campaign_id: model.MC.foreign, readback: { ...receipt.readback, campaign_id: model.MC.foreign } } };
  if (data.mode === "wrong-instance") return { status: "saved", receipt: { ...receipt, instance_id: model.MC.foreign, readback: { ...receipt.readback, id: model.MC.foreign },
    canonical_intent: { ...receipt.canonical_intent, instance_id: model.MC.foreign } } };
  if (data.mode === "wrong-operation") return { status: "saved", receipt: { ...receipt, operation_id: model.MC.foreign, canonical_intent: { ...receipt.canonical_intent, operation_id: model.MC.foreign } } };
  if (data.mode === "wrong-intent") return { status: "saved", receipt: { ...receipt, canonical_intent: { ...receipt.canonical_intent, name: "Different original intent" }, readback: { ...receipt.readback, name: "Different original intent" } } };
  return { status: "saved", receipt };
}
const evidence = [], screenshots = [], fontEvidence = [], pageErrors = [], networkErrors = [], diagnostics = [], assetRequests = [];
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "POST" && /^\/__model\/(control|inspect|preview|resolve|commit)$/.test(url.pathname)) {
      let body = ""; for await (const part of request) { body += String(part); assert.ok(Buffer.byteLength(body) <= 262144); }
      const result = action(url.pathname.slice("/__model/".length), JSON.parse(body));
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(result) ?? "null"); return;
    }
    if (request.method !== "GET") throw Error("Unexpected HTTP method");
    if (production.assets.has(url.pathname)) {
      const asset = production.assets.get(url.pathname); assetRequests.push({ path: url.pathname, sha256: asset.sha256 });
      response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "application/octet-stream"); response.end(asset.bytes); return;
    }
    if (url.pathname === "/fixture.js") { assert.equal(hash(fixtureBytes), fixtureBundle.outputSha256); assert.equal(fixtureBytes.length, fixtureBundle.outputBytes); response.setHeader("Content-Type", "text/javascript"); response.end(fixtureBytes); return; }
    if (url.pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
    assert.ok(url.pathname === "/fixture" || /^\/campaigns\/[^/]+\/monsters\/[^/]+$/.test(url.pathname));
    const payload = JSON.stringify({ props: props(url), scenario: state.mode }).replaceAll("<", "\\u003c");
    response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html lang="en" class="' + production.htmlClassName +
      '"><head><meta name="viewport" content="width=device-width,initial-scale=1">' + production.cssUrls.map(url => '<link rel="stylesheet" href="' + url + '">').join("") +
      '</head><body class="min-h-full font-sans"><div class="px-4 py-6" id="root"></div><script id="model-props" type="application/json">' + payload +
      '</script><script src="/fixture.js"></script></body></html>');
  } catch (error) { diagnostics.push(error.message); response.writeHead(500).end("Modeled boundary refused"); }
});
let browserServer, browser, browserProcess, port, browserPort, failure, finalProof;
let observed = [];
closeRuntime = () => { failure ??= Error("Owning wrapper requested cooperative stop"); void browser?.close().catch(() => {}); if (server.listening) server.close(); };
await checkpoint("server startup", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); port = server.address().port; taskProcess.port = port;
async function closed(value) {
  return new Promise(resolve => { const socket = net.connect(value, "127.0.0.1"); socket.once("connect", () => { socket.destroy(); resolve(false); }); socket.once("error", () => resolve(true)); });
}
try {
  await checkpoint("browser startup", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
  remaining("cases/finals/cleanup", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
  browserServer = await chromium.launchServer({ channel: "chrome", headless: true, host: "127.0.0.1", port: 0 });
  await checkpoint("browser attach", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
  browserPort = Number(new URL(browserServer.wsEndpoint()).port);
  browserProcess = { ...await processes.freshIdentity(browserServer.process().pid, process.pid), cwd: root, port: browserPort, startUtc: new Date().toISOString() };
  browser = await chromium.connect(browserServer.wsEndpoint());
  observed = await processes.ownedSnapshot(taskProcess);
  assert.ok(Date.now() - gateStartedAt <= phases.entryMs, "Actual whole-gate entry exceeded reviewed allocation");
  const { runCampaignMonsterCases } = await import("./campaign-monster-scenarios.mjs");
  await checkpoint("cases", phases.casesMs + phases.finalMs + phases.cleanupMs + phases.reserveMs);
  await runCampaignMonsterCases({ browser, origin: "http://127.0.0.1:" + port, output, evidence, screenshots, fontEvidence, pageErrors, networkErrors, diagnostics,
    allowedAssets: [...production.assets.keys()], assetRequests, deadline: Math.min(deadline - phases.finalMs - phases.cleanupMs - phases.reserveMs, Date.now() + phases.casesMs),
    configure: async spec => configure(spec), checkpoint });
  assert.equal(evidence.length, 44); assert.equal(screenshots.length, 44); assert.equal(fontEvidence.length, 44);
  assert.deepEqual(pageErrors, []); assert.deepEqual(networkErrors, []); assert.deepEqual(diagnostics, []);
  observed = [...new Map([...observed, ...await processes.ownedSnapshot(taskProcess)].map(row => [row.pid + ":" + row.birthUtc, row])).values()];
} catch (error) { failure = error; }
finally {
  await browser?.close().catch(error => { failure ??= error; });
  await browserServer?.close().catch(error => { failure ??= error; });
  await new Promise(resolve => server.close(resolve));
  try {
    remaining("complete final proof and cleanup", phases.finalMs + phases.cleanupMs);
    finalProof = await inputs.measureGuard("post-teardown-full-proof", async () => {
      const fresh = await inputs.rebindCampaignMonsterInputs(root, descriptor.buildManifestPath, processes.receipt,
        browserBundle.metafile, captured, production.artifacts, modelBundle, fixtureBundle);
      assert.deepEqual(fresh, renderedProof); assert.deepEqual(await bootstrap(root), boot); return fresh;
    }, record => { timing.push(record); assert.ok(record.elapsedMs <= phases.runnerFinalMs, "Measured runner final exceeds reviewed allocation"); });
  } catch (error) { failure ??= error; }
}
const browserReadback = browserProcess ? await processes.absentIdentity(browserProcess) : null;
const observedReadback = [];
for (const identity of observed) if (identity.pid !== process.pid) observedReadback.push(await processes.absentIdentity(identity));
const resourcesAfter = processes.resources();
const result = { liveSupabase: false, persistence: "modeled-memory-only", sourceCheckpoint: inputs.campaignMonsterSourceCheckpoint,
  sourceAmendments: inputs.campaignMonsterSourceAmendments,
  evidence, screenshots, fontEvidence, pageErrors, networkErrors, diagnostics, assetRequests, taskProcess, browserProcess, timing,
  finalProof, resourcesBefore, resourcesAfter, browserReadback, observed, observedReadback, portClosed: await closed(port), browserPortClosed: browserPort ? await closed(browserPort) : true,
  failure: failure?.message ?? null };
if (!result.portClosed || !result.browserPortClosed || (browserReadback && !browserReadback.absent) || !observedReadback.every(row => row.absent)) {
  failure ??= Error("Owned process/port cleanup is unproved"); result.failure = failure.message;
}
await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(result, null, 2), { flag: "wx" });
process.send?.({ type: "result", output });
if (failure) throw failure;
assert.equal(result.portClosed, true); assert.equal(result.browserPortClosed, true);
if (browserReadback) assert.equal(browserReadback.absent, true);
assert.ok(observedReadback.every(row => row.absent));
