// ─── Token types ───────────────────────────────────────────────
type TokenKind =
  | "number"
  | "ident"
  | "string"
  | "op"
  | "lparen"
  | "rparen"
  | "comma";

interface Token {
  kind: TokenKind;
  value: string;
}

// ─── Math builtins available in every expression ───────────────
const MATH_BUILTINS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  max: Math.max,
  min: Math.min,
};

// ─── Tokenizer ─────────────────────────────────────────────────
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Whitespace — skip
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ kind: "number", value: num });
      continue;
    }

    // Identifier (a-z, A-Z, _)
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ kind: "ident", value: id });
      continue;
    }

    // String literal (single or double quoted)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++; // skip opening quote
      let str = "";
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i++];
      }
      if (i >= expr.length) throw new Error(`Unterminated string literal`);
      i++; // skip closing quote
      tokens.push({ kind: "string", value: str });
      continue;
    }

    // Operators
    if ("+-*/".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ kind: "lparen", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen", value: ")" });
      i++;
      continue;
    }

    // Comma
    if (ch === ",") {
      tokens.push({ kind: "comma", value: "," });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${ch}'`);
  }

  return tokens;
}

// ─── Recursive-descent parser / evaluator ──────────────────────
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(
    tokens: Token[],
    private stats: Record<string, number>,
    private builtins: Record<string, (...args: unknown[]) => number>,
  ) {
    this.tokens = tokens;
  }

  /** Entry point — parse full expression, ensure nothing left over */
  parse(): number {
    const result = this.addSub();
    if (this.pos < this.tokens.length) {
      throw new Error(
        `Unexpected token: '${this.tokens[this.pos].value}'`,
      );
    }
    return result;
  }

  // ── Addition / Subtraction (lowest precedence) ──
  private addSub(): number {
    let left = this.mulDiv();
    while (this.match("op", "+") || this.match("op", "-")) {
      const op = this.tokens[this.pos - 1].value;
      const right = this.mulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // ── Multiplication / Division ──
  private mulDiv(): number {
    let left = this.unary();
    while (this.match("op", "*") || this.match("op", "/")) {
      const op = this.tokens[this.pos - 1].value;
      const right = this.unary();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  // ── Unary minus ──
  private unary(): number {
    if (this.match("op", "-")) {
      return -this.unary();
    }
    return this.primary();
  }

  // ── Primary: number | parenthesized expr | function call | stat ref ──
  private primary(): number {
    const tok = this.peek();

    if (!tok) throw new Error("Unexpected end of expression");

    // Number literal
    if (tok.kind === "number") {
      this.pos++;
      return parseFloat(tok.value);
    }

    // Parenthesized expression
    if (tok.kind === "lparen") {
      this.pos++; // skip (
      const val = this.addSub();
      this.expect("rparen");
      return val;
    }

    // Identifier — could be function call or stat reference
    if (tok.kind === "ident") {
      this.pos++;
      const name = tok.value;

      // Function call: ident followed by (
      if (this.peek()?.kind === "lparen") {
        return this.functionCall(name);
      }

      // Stat reference
      if (name in this.stats) {
        return this.stats[name];
      }

      throw new Error(`Unknown identifier: '${name}'`);
    }

    throw new Error(`Unexpected token: '${tok.value}'`);
  }

  // ── Function call: already consumed the ident, next token is ( ──
  private functionCall(name: string): number {
    this.expect("lparen"); // consume (

    const args: unknown[] = [];

    // Parse arguments
    if (this.peek()?.kind !== "rparen") {
      args.push(this.parseArg());
      while (this.match("comma")) {
        args.push(this.parseArg());
      }
    }

    this.expect("rparen"); // consume )

    // Resolve function: caller builtins first, then math builtins
    const fn =
      this.builtins[name] ?? MATH_BUILTINS[name];

    if (!fn) {
      throw new Error(`Unknown function: '${name}'`);
    }

    return fn(...args);
  }

  /** Parse a single function argument — either a string literal or an expression */
  private parseArg(): unknown {
    const tok = this.peek();
    if (tok?.kind === "string") {
      this.pos++;
      return tok.value;
    }
    return this.addSub();
  }

  // ── Helpers ──
  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private match(kind: TokenKind, value?: string): boolean {
    const tok = this.peek();
    if (tok && tok.kind === kind && (value === undefined || tok.value === value)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expect(kind: TokenKind): void {
    const tok = this.peek();
    if (!tok || tok.kind !== kind) {
      throw new Error(
        `Expected ${kind}, got ${tok ? `'${tok.value}'` : "end of expression"}`,
      );
    }
    this.pos++;
  }
}

// ─── Public API ────────────────────────────────────────────────
export function parseExpression(
  expr: string,
  stats: Record<string, number>,
  builtins: Record<string, (...args: unknown[]) => number> = {},
): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) {
    throw new Error("Empty expression");
  }
  const parser = new Parser(tokens, stats, builtins);
  return parser.parse();
}
