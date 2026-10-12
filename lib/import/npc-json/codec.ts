import { z } from "zod";
import { npcNameSchema } from "@/lib/homebrew/npc-form";
import { npcDataSchema } from "@/lib/schemas/content-types/npc";
import { NPC_JSON_LIMITS, type NpcJsonDecoded, type NpcJsonDiagnostic, type NpcJsonLimits, type NpcJsonLocation, type NpcJsonPath } from "./types";

const candidateSchema = z.strictObject({ format: z.literal("inkborne-npc"), format_version: z.literal(1), name: npcNameSchema,
  data: npcDataSchema, effects: z.array(z.unknown()).length(0) });
const pointer = (parts: NpcJsonPath) => `/${parts.map(part => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
class Refusal extends Error {
  constructor(readonly diagnostic: NpcJsonDiagnostic) { super(diagnostic.message); }
}
const failure = (code: string, message: string, location: NpcJsonLocation = { byteOffset: 0, line: 1, column: 1 }): NpcJsonDecoded =>
  ({ success: false, diagnostics: [{ code, message, path: "/", location }] });

/** First byte of an invalid UTF-8 sequence; line/column count Unicode scalars, LF newlines. */
function invalidUtf8(bytes: Uint8Array): NpcJsonLocation | undefined {
  let line = 1, column = 1;
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]; let count = 1;
    if (first < 0x80) count = 1;
    else if (first >= 0xc2 && first <= 0xdf) count = 2;
    else if (first >= 0xe0 && first <= 0xef) count = 3;
    else if (first >= 0xf0 && first <= 0xf4) count = 4;
    else return { byteOffset: index, line, column };
    if (index + count > bytes.length) return { byteOffset: index, line, column };
    for (let offset = 1; offset < count; offset++) if (bytes[index + offset] < 0x80 || bytes[index + offset] > 0xbf) return { byteOffset: index, line, column };
    const second = bytes[index + 1];
    if ((first === 0xe0 && second < 0xa0) || (first === 0xed && second > 0x9f) ||
      (first === 0xf0 && second < 0x90) || (first === 0xf4 && second > 0x8f)) return { byteOffset: index, line, column };
    if (first === 10) { line++; column = 1; } else column++;
    index += count;
  }
}

class BoundedJson {
  private index = 0;
  private nodes = 0;
  private members = 0;
  private positions: NpcJsonLocation[] = [];
  readonly values = new Map<string, number>();
  readonly keys = new Map<string, number>();
  constructor(private text: string, private limits: NpcJsonLimits) {
    let byteOffset = 0, line = 1, column = 1;
    for (let index = 0; index < text.length;) {
      const point = text.codePointAt(index)!;
      this.positions[index] = { byteOffset, line, column };
      if (point > 0xffff) this.positions[index + 1] = this.positions[index];
      byteOffset += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
      if (point === 10) { line++; column = 1; } else column++;
      index += point > 0xffff ? 2 : 1;
    }
    this.positions[text.length] = { byteOffset, line, column };
  }
  location(index: number) { return this.positions[index] ?? this.positions[this.text.length]; }
  reject(code: string, message: string, parts: NpcJsonPath, index = this.index): never {
    throw new Refusal({ code, message: message.slice(0, 200), path: pointer(parts).slice(0, 100), location: this.location(index) });
  }
  private space() { while (/[ \t\r\n]/.test(this.text[this.index] ?? "x")) this.index++; }
  parse(): unknown {
    this.space(); const value = this.value([], 1); this.space();
    if (this.index !== this.text.length) this.reject("SYNTAX", "Trailing non-whitespace is not JSON.", []);
    return value;
  }
  private value(parts: NpcJsonPath, depth: number): unknown {
    this.space();
    if (depth > this.limits.depth) this.reject("DEPTH_LIMIT", "JSON nesting exceeds the depth limit.", parts);
    if (++this.nodes > this.limits.nodes) this.reject("NODE_LIMIT", "JSON values exceed the node limit.", parts);
    this.values.set(JSON.stringify(parts), this.index);
    const token = this.text[this.index];
    if (token === '"') return this.string(parts);
    if (token === "{") {
      this.index++; const output: Record<string, unknown> = {}; const seen = new Set<string>(); this.space();
      if (this.text[this.index] === "}") { this.index++; return output; }
      while (true) {
        this.space();
        if (++this.members > this.limits.members) this.reject("MEMBER_LIMIT", "Object members exceed the limit.", parts);
        const keyIndex = this.index;
        if (this.text[this.index] !== '"') this.reject("SYNTAX", "Object keys must be JSON strings.", parts);
        const key = this.string(parts), path = [...parts, key];
        this.keys.set(JSON.stringify(path), keyIndex);
        if (["__proto__", "prototype", "constructor"].includes(key)) this.reject("DANGEROUS_KEY", "Prototype-related object keys are forbidden.", path, keyIndex);
        if (seen.has(key)) this.reject("DUPLICATE_KEY", "Repeated decoded object key is forbidden.", path, keyIndex);
        seen.add(key); this.space();
        if (this.text[this.index++] !== ":") this.reject("SYNTAX", "Expected a colon after the object key.", path, this.index - 1);
        const value = this.value(path, depth + 1); output[key] = value; this.space();
        const end = this.text[this.index++];
        if (end === "}") return output;
        if (end !== ",") this.reject("SYNTAX", "Expected comma or closing object brace.", parts, this.index - 1);
      }
    }
    if (token === "[") {
      this.index++; const output: unknown[] = []; this.space();
      if (this.text[this.index] === "]") { this.index++; return output; }
      while (true) {
        const value = this.value([...parts, output.length], depth + 1); output.push(value); this.space();
        const end = this.text[this.index++];
        if (end === "]") return output;
        if (end !== ",") this.reject("SYNTAX", "Expected comma or closing array bracket.", parts, this.index - 1);
      }
    }
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (this.text.startsWith(literal, this.index)) { this.index += literal.length; return value; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.index));
    if (number) {
      const start = this.index; this.index += number[0].length; const value = Number(number[0]);
      if (!Number.isFinite(value)) this.reject("NON_FINITE", "JSON numeric result must be finite.", parts, start);
      return value;
    }
    this.reject("SYNTAX", "Expected a JSON value.", parts);
  }
  private string(parts: NpcJsonPath): string {
    this.index++; const units: string[] = [], origins: number[] = [];
    const escapes: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    while (this.index < this.text.length) {
      const start = this.index, char = this.text[this.index++];
      if (char === '"') {
        for (let index = 0; index < units.length; index++) {
          const code = units[index].charCodeAt(0);
          if (code === 0) this.reject("INVALID_STRING", "Decoded NUL cannot be represented by PostgreSQL JSONB.", parts, origins[index]);
          if (code >= 0xd800 && code <= 0xdbff) {
            const next = units[index + 1]?.charCodeAt(0);
            if (next === undefined || next < 0xdc00 || next > 0xdfff) this.reject("INVALID_STRING", "Decoded high surrogate requires its low surrogate.", parts, origins[index]);
            index++;
          } else if (code >= 0xdc00 && code <= 0xdfff) this.reject("INVALID_STRING", "Decoded low surrogate requires its high surrogate.", parts, origins[index]);
        }
        return units.join("");
      }
      if (char === "\\") {
        const escape = this.text[this.index++];
        if (escape === "u") {
          const hex = this.text.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.reject("SYNTAX", "Unicode escape requires four hexadecimal digits.", parts, start);
          units.push(String.fromCharCode(Number.parseInt(hex, 16))); origins.push(start); this.index += 4;
        } else if (Object.hasOwn(escapes, escape)) { units.push(escapes[escape]); origins.push(start); }
        else this.reject("SYNTAX", "Unknown JSON string escape.", parts, start);
      } else {
        if (char.charCodeAt(0) < 0x20) this.reject("SYNTAX", "Unescaped control character is not valid JSON.", parts, start);
        units.push(char); origins.push(start);
      }
    }
    this.reject("SYNTAX", "Unterminated JSON string.", parts);
  }
}

/** No defaults/coercion/stripping/evaluation; decoded object order is not a JSONB guarantee. */
export function decodeNpcJson(bytes: Uint8Array, filename: string, options: { expectedSize?: number; limits?: Partial<NpcJsonLimits> } = {}): NpcJsonDecoded {
  const limits = { ...NPC_JSON_LIMITS };
  for (const key of Object.keys(options.limits ?? {}) as Array<keyof NpcJsonLimits>) {
    const value = options.limits![key];
    if (!(key in limits) || !Number.isSafeInteger(value) || value! < 1 || value! > NPC_JSON_LIMITS[key]) return failure("INVALID_LIMITS", "Codec ceilings may only be lowered to positive integers.");
    limits[key] = value!;
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > limits.bytes) return failure("BYTE_LIMIT", "JSON file must fit the finite byte limit.");
  if (options.expectedSize !== undefined && options.expectedSize !== bytes.byteLength) return failure("SIZE_MISMATCH", "Declared and actual file byte lengths differ.");
  if (typeof filename !== "string") return failure("FILENAME", "A safe JSON filename is required.");
  const safeFilename = filename.split(/[\\/]/).at(-1)!.trim();
  if (!safeFilename || safeFilename.length > 255 || /[\x00-\x1f\x7f]/.test(safeFilename) || !/\.json$/i.test(safeFilename)) return failure("FILENAME", "Filename must be a bounded JSON basename without control characters.");
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return failure("BOM", "A leading UTF-8 BOM is unsupported; bytes are not silently rewritten.");
  const malformed = invalidUtf8(bytes); if (malformed) return failure("UTF8", "Invalid UTF-8 sequence.", malformed);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes), parser = new BoundedJson(text, limits);
  try {
    const raw = parser.parse(), validated = candidateSchema.safeParse(raw);
    if (!validated.success) {
      const diagnostics: NpcJsonDiagnostic[] = [], pathCounts = new Map<string, number>();
      for (const issue of validated.error.issues) {
        const parts = issue.path.filter((part): part is string | number => typeof part !== "symbol"), path = pointer(parts).slice(0, 100);
        if (!pathCounts.has(path) && pathCounts.size >= 100) continue;
        if ((pathCounts.get(path) ?? 0) >= 3) continue;
        pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
        const key = issue.code === "unrecognized_keys" ? [...parts, issue.keys[0]] : parts;
        const offset = (issue.code === "unrecognized_keys" ? parser.keys.get(JSON.stringify(key)) : parser.values.get(JSON.stringify(parts))) ?? 0;
        diagnostics.push({ code: "SCHEMA", path, message: issue.message.slice(0, 200), location: parser.location(offset) });
      }
      return { success: false, diagnostics };
    }
    return { success: true, candidate: raw as typeof validated.data & { effects: [] }, safeFilename,
      origins: [...parser.values].map(([parts, index]) => ({ path: pointer(JSON.parse(parts) as Array<string | number>), location: parser.location(index) })) };
  } catch (error) { if (error instanceof Refusal) return { success: false, diagnostics: [error.diagnostic] }; throw error; }
}
