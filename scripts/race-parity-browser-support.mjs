import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";

export const offlineRaceParityStubs = {
  "next/navigation": `const router={push:path=>window.fixture.navigation.push(path),refresh:()=>window.fixture.navigation.push('refresh')};export const useRouter=()=>router;`,
  "next/link": `import React from 'react';export default function Link(props){return React.createElement('a',props)}`,
  "@/lib/supabase/character-client": `const denied=async(...args)=>{window.fixture.writes.push({boundary:'character',args});throw Error('Offline writes prohibited')};export const updateCharacter=denied;export const updateCharacterAndReturn=denied;`,
  "@/lib/supabase/content-refs-client": `const denied=async(...args)=>{window.fixture.writes.push({boundary:'refs',args});throw Error('Offline writes prohibited')};export const insertContentRef=denied;export const removeContentRefById=denied;`,
  "@/app/(app)/characters/[id]/builder/class/actions": `const denied=async(...args)=>{window.fixture.writes.push({boundary:'class-actions',args});throw Error('Offline actions prohibited')};export const reconcileClassFeatureRefsAction=denied;export const searchUsableFeatsAction=denied;export const setCharacterAsiChoiceAction=denied;`,
  "@/lib/builder/use-ability-score-draft": `export function useAbilityScoreDraft(owner,id,initial){return {draft:initial,status:'saved',changeDraft:()=>{window.fixture.writes.push({boundary:'ability-draft'});throw Error('Offline draft writes prohibited')},retry:()=>{window.fixture.writes.push({boundary:'ability-retry'});throw Error('Offline retry prohibited')}}}export function discardAbilityScoreDraft(){window.fixture.writes.push({boundary:'discard-draft'});throw Error('Offline draft writes prohibited')}`,
};

export function offlineParityPlugin(root) {
  return { name: "explicit-offline-race-boundaries", setup(builder) {
    builder.onResolve({ filter: /^\.\/actions$/ }, args => {
      if (args.importer.replaceAll(String.fromCharCode(92), '/').endsWith('/app/(app)/characters/[id]/builder/class/class-step-client.tsx')) {
        return { path: '@/app/(app)/characters/[id]/builder/class/actions', namespace: 'offline-parity' };
      }
      return undefined;
    });
    builder.onResolve({ filter: /^(next\/|@\/lib\/supabase\/|@\/lib\/builder\/use-ability-score-draft|@\/app\/\(app\)\/characters\/\[id\]\/builder\/class\/actions)/ }, args => {
      if (Object.hasOwn(offlineRaceParityStubs, args.path)) return { path: args.path, namespace: "offline-parity" };
      if (args.path.startsWith("next/headers") || args.path.startsWith("@/lib/supabase/client") || args.path.startsWith("@/lib/supabase/server")) {
        throw Error(`Unapproved live boundary: ${args.path}`);
      }
      return undefined; // Actual runtime-neutral parsers are intentionally real.
    });
    builder.onLoad({ filter: /.*/, namespace: "offline-parity" }, args => ({ contents: offlineRaceParityStubs[args.path], loader: "js", resolveDir: root }));
  } };
}

export async function loadProductionStyles(receiptPath) {
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  if (!receipt || Array.isArray(receipt) || Object.keys(receipt).some(key => !["buildRoot", "sourceSha", "buildId"].includes(key))
    || typeof receipt.buildRoot !== "string" || !path.isAbsolute(receipt.buildRoot)
    || !/^[a-f0-9]{40}$/.test(receipt.sourceSha) || typeof receipt.buildId !== "string" || !receipt.buildId.trim()) {
    throw Error("Expected explicit buildRoot/sourceSha/buildId production build receipt.");
  }
  const buildRoot = await fs.realpath(receipt.buildRoot);
  const buildId = (await fs.readFile(path.join(buildRoot, ".next", "BUILD_ID"), "utf8")).trim();
  if (buildId !== receipt.buildId) throw Error("Production BUILD_ID differs from supplied receipt.");
  const staticRoot = await fs.realpath(path.join(buildRoot, ".next", "static"));
  const styles = [];
  async function visit(directory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith(".css")) {
        const css = await fs.readFile(file, "utf8");
        styles.push({ relativePath: path.relative(staticRoot, file).split(path.sep).join("/"),
          sha256: createHash("sha256").update(css).digest("hex"), bytes: Buffer.byteLength(css), css });
      }
    }
  }
  await visit(staticRoot);
  if (!styles.length) throw Error("Root production build contains no CSS; no globals fallback is allowed.");
  const fonts = [];
  const unquote = value => value.trim().replace(/^['"]|['"]$/g, "");
  for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
    const declarations = [];
    for (const style of styles) postcss.parse(style.css).walkDecls(variable, declaration => {
      const selector = declaration.parent.selector;
      if (!/^\.[A-Za-z_][\w-]*$/.test(selector ?? "")) throw Error(`Unexpected production font selector: ${selector}`);
      declarations.push({ className: selector.slice(1), family: unquote(declaration.value.split(",")[0]) });
    });
    const unique = [...new Map(declarations.map(entry => [JSON.stringify(entry), entry])).values()];
    if (unique.length !== 1) throw Error(`Expected one generated production class for ${variable}.`);
    const font = { variable, ...unique[0], faces: [] };
    for (const style of styles) {
      const faces = [];
      postcss.parse(style.css).walkAtRules("font-face", rule => {
        const values = Object.fromEntries(rule.nodes.filter(node => node.type === "decl").map(node => [node.prop, node.value]));
        if (unquote(values["font-family"] ?? "") === font.family) faces.push(values);
      });
      for (const face of faces) {
        const sources = [...(face.src ?? "").matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
        if (!sources.length) throw Error(`Expected local production font asset for ${font.family}.`);
        for (const source of sources) {
          const url = new URL(source[2], `http://offline.invalid/_next/static/${style.relativePath}`);
          if (url.origin !== "http://offline.invalid" || url.search || url.hash) throw Error("Remote or ambiguous production font asset refused.");
          const file = await staticAssetPath(staticRoot, url.pathname);
          if (!file || !/\.(?:woff2?|ttf|otf)$/.test(file)) throw Error("Missing contained production font asset.");
          const bytes = await fs.readFile(file);
          font.faces.push({ family: font.family, style: face["font-style"] ?? "normal", weight: face["font-weight"] ?? "normal",
            requestPath: url.pathname, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
        }
      }
    }
    if (!font.faces.some(face => face.style === "normal") || (variable === "--font-eb-garamond" && !font.faces.some(face => face.style === "italic"))) {
      throw Error(`Expected production FontFaces missing for ${variable}.`);
    }
    fonts.push(font);
  }
  const fontClasses = fonts.map(font => font.className);
  return { buildRoot, sourceSha: receipt.sourceSha, buildId, staticRoot, styles, fontClasses, fonts };
}

export async function staticAssetPath(staticRoot, requestPath) {
  if (!requestPath.startsWith("/_next/static/")) return null;
  const relative = decodeURIComponent(requestPath.slice("/_next/static/".length));
  if (!/\.(?:css|woff2?|ttf|otf|svg|png|webp)$/.test(relative)) return null;
  const resolved = path.resolve(staticRoot, relative);
  const within = target => target.startsWith(staticRoot + path.sep);
  if (!within(resolved)) return null;
  const real = await fs.realpath(resolved).catch(() => null);
  return real && within(real) ? real : null;
}
