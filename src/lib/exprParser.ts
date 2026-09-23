/**
 * Expression parser for CNC dimensions and unitless arithmetic values.
 * Supports standard arithmetic (+, -, *, /, parens, floats).
 * When units are enabled, supports mixed mm and inch units (defaults unitless to mm).
 * When units are disabled (allowUnits: false), evaluates pure arithmetic and rejects unit tokens.
 *
 * Examples with units:
 *   "1/4in"        -> 6.35 mm
 *   "1/8"          -> 0.125 mm
 *   "1+6-3/4mm"    -> 6.25 mm
 *   "1mm - 1/32in" -> 0.20625 mm
 *   "(2 + 1/2)in"  -> 63.5 mm
 *
 * Examples without units (allowUnits: false):
 *   "12*1000"      -> 12000
 *   "24000/2"      -> 12000
 *   "(10 + 2)*1000"-> 12000
 *   "12000rpm"     -> Error ("Units are not allowed in this field")
 */

export interface ParseOptions {
  allowUnits?: boolean; // Defaults to true
}

export interface ExpressionParseResult {
  value: number;
  formatted: string;
  formattedMm: string;
  formattedIn: string;
  error?: string;
}

export type ParseResult = ExpressionParseResult;

type TokenType = "NUMBER" | "UNIT" | "OP" | "LPAREN" | "RPAREN" | "EOF";

interface Token {
  type: TokenType;
  value: string;
  unitMultiplier?: number; // 25.4 for inches, 1.0 for mm
}

function preprocess(input: string, allowUnits = true): string {
  let str = input.trim();
  if (!allowUnits) {
    return str;
  }
  // Normalize quotes to in
  str = str.replace(/["”″]/g, "in");
  // Normalize "inch", "inches" to "in"
  str = str.replace(/\b(inches|inch)\b/gi, "in");
  // Handle mixed fractions like "1 1/2in" -> "(1 + (1 / 2))in"
  str = str.replace(
    /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(in|mm)?/gi,
    "($1 + ($2 / $3))$4",
  );
  // Handle fractions with units e.g. "1/4in" or "3/4mm" -> "(1/4)in" or "(3/4)mm"
  str = str.replace(
    /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(in|mm)\b/gi,
    "($1 / $2)$3",
  );
  return str;
}

function tokenize(input: string, allowUnits = true): Token[] {
  const text = preprocess(input, allowUnits);
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: ch });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ch });
      i++;
      continue;
    }

    // Number (integer or float)
    if (/\d|\./.test(ch)) {
      let numStr = "";
      let hasDot = false;
      while (
        i < text.length &&
        (/\d/.test(text[i]) || (text[i] === "." && !hasDot))
      ) {
        if (text[i] === ".") hasDot = true;
        numStr += text[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });

      // Check if letters or quotes directly follow the number, e.g. 5mm or 0.25in
      if (i < text.length && /[a-zA-Z"”″]/.test(text[i])) {
        if (!allowUnits) {
          throw new Error("Units are not allowed in this field");
        }
        let unitStr = "";
        while (i < text.length && /[a-zA-Z]/.test(text[i])) {
          unitStr += text[i];
          i++;
        }
        const lower = unitStr.toLowerCase();
        if (lower === "mm") {
          tokens.push({ type: "UNIT", value: "mm", unitMultiplier: 1.0 });
        } else if (lower === "in" || lower === "inch" || lower === "inches") {
          tokens.push({ type: "UNIT", value: "in", unitMultiplier: 25.4 });
        } else {
          throw new Error(`Unknown unit "${unitStr}"`);
        }
      }
      continue;
    }

    // Word or unit symbol separated by space, e.g. "5 in"
    if (/[a-zA-Z"”″]/.test(ch)) {
      if (!allowUnits) {
        throw new Error("Units are not allowed in this field");
      }
      let unitStr = "";
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        unitStr += text[i];
        i++;
      }
      const lower = unitStr.toLowerCase();
      if (lower === "mm") {
        tokens.push({ type: "UNIT", value: "mm", unitMultiplier: 1.0 });
      } else if (lower === "in" || lower === "inch" || lower === "inches") {
        tokens.push({ type: "UNIT", value: "in", unitMultiplier: 25.4 });
      } else {
        throw new Error(`Unknown unit "${unitStr}"`);
      }
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at index ${i}`);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(expectedType?: TokenType): Token {
    const current = this.peek();
    if (expectedType && current.type !== expectedType) {
      throw new Error(
        `Expected ${expectedType} but found ${current.type} (${current.value})`,
      );
    }
    this.pos++;
    return current;
  }

  public parse(): number {
    if (this.peek().type === "EOF") {
      throw new Error("Empty expression");
    }
    const val = this.parseExpr();
    if (this.peek().type !== "EOF") {
      throw new Error(
        `Unexpected token "${this.peek().value}" after expression`,
      );
    }
    return val;
  }

  // expr = term (( '+' | '-' ) term)*
  private parseExpr(): number {
    let result = this.parseTerm();

    while (
      this.peek().type === "OP" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.consume().value;
      const nextTerm = this.parseTerm();
      if (op === "+") {
        result += nextTerm;
      } else {
        result -= nextTerm;
      }
    }

    return result;
  }

  // term = factor (( '*' | '/' ) factor)* (unit)?
  private parseTerm(): number {
    let result = this.parseFactor();

    while (
      this.peek().type === "OP" &&
      (this.peek().value === "*" || this.peek().value === "/")
    ) {
      const op = this.consume().value;
      const nextFactor = this.parseFactor();
      if (op === "*") {
        result *= nextFactor;
      } else {
        if (nextFactor === 0) {
          throw new Error("Division by zero");
        }
        result /= nextFactor;
      }
    }

    // If unit follows the term (e.g. 1/32 in, or (1 + 1/2) in)
    if (this.peek().type === "UNIT") {
      const unit = this.consume("UNIT");
      result *= unit.unitMultiplier ?? 1.0;
    }

    return result;
  }

  // factor = ( '+' | '-' )? atom
  private parseFactor(): number {
    const current = this.peek();
    if (
      current.type === "OP" &&
      (current.value === "+" || current.value === "-")
    ) {
      const op = this.consume().value;
      const val = this.parseAtom();
      return op === "-" ? -val : val;
    }
    return this.parseAtom();
  }

  // atom = NUMBER (unit)? | '(' expr ')' (unit)?
  private parseAtom(): number {
    const current = this.peek();

    if (current.type === "NUMBER") {
      this.consume("NUMBER");
      const val = parseFloat(current.value);
      if (Number.isNaN(val)) {
        throw new Error(`Invalid number: ${current.value}`);
      }

      // Check if unit directly follows number
      if (this.peek().type === "UNIT") {
        const unit = this.consume("UNIT");
        return val * (unit.unitMultiplier ?? 1.0);
      }

      return val;
    }

    if (current.type === "LPAREN") {
      this.consume("LPAREN");
      let val = this.parseExpr();
      this.consume("RPAREN");

      // Unit could also follow parenthesized expression e.g. (1+2)in
      if (this.peek().type === "UNIT") {
        const unit = this.consume("UNIT");
        val *= unit.unitMultiplier ?? 1.0;
      }

      return val;
    }

    throw new Error(`Unexpected token "${current.value}"`);
  }
}

/**
 * Evaluates an arithmetic expression with optional unit support.
 */
export function parseExpression(
  input: string | number | undefined,
  options: ParseOptions = {},
): ExpressionParseResult {
  const allowUnits = options.allowUnits ?? true;

  if (input === undefined || input === null) {
    return {
      value: 0,
      formatted: "0",
      formattedMm: "0 mm",
      formattedIn: '0"',
      error: "Empty value",
    };
  }

  if (typeof input === "number") {
    if (Number.isNaN(input) || !Number.isFinite(input)) {
      return {
        value: 0,
        formatted: "0",
        formattedMm: "0 mm",
        formattedIn: '0"',
        error: "Invalid number",
      };
    }
    const formatted = formatNumber(input);
    const inVal = input / 25.4;
    return {
      value: input,
      formatted,
      formattedMm: `${formatted} mm`,
      formattedIn: `${formatNumber(inVal)}"`,
    };
  }

  const str = input.trim();
  if (!str) {
    return {
      value: 0,
      formatted: "0",
      formattedMm: "0 mm",
      formattedIn: '0"',
      error: "Empty expression",
    };
  }

  try {
    const tokens = tokenize(str, allowUnits);
    const parser = new Parser(tokens);
    const val = parser.parse();

    if (Number.isNaN(val) || !Number.isFinite(val)) {
      return {
        value: 0,
        formatted: "0",
        formattedMm: "0 mm",
        formattedIn: '0"',
        error: "Result is not a finite number",
      };
    }

    const formatted = formatNumber(val);
    const inVal = val / 25.4;
    return {
      value: val,
      formatted,
      formattedMm: `${formatted} mm`,
      formattedIn: `${formatNumber(inVal)}"`,
    };
  } catch (err) {
    return {
      value: 0,
      formatted: "Error",
      formattedMm: "Error",
      formattedIn: "Error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parses any dimension string into millimeters (with mixed unit support).
 */
export function parseDimension(
  input: string | number | undefined,
): ParseResult {
  return parseExpression(input, { allowUnits: true });
}

/**
 * Parses a pure arithmetic expression without units (e.g. "12*1000").
 * Rejects units with an error.
 */
export function parseUnitless(
  input: string | number | undefined,
): ExpressionParseResult {
  return parseExpression(input, { allowUnits: false });
}

/**
 * Evaluates dimension to numeric mm with fallback.
 */
export function evalDim(
  input: string | number | undefined,
  fallback = 0,
): number {
  const res = parseDimension(input);
  return res.error ? fallback : res.value;
}

/**
 * Evaluates unitless expression to numeric value with fallback.
 */
export function evalUnitless(
  input: string | number | undefined,
  fallback = 0,
): number {
  const res = parseUnitless(input);
  return res.error ? fallback : res.value;
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 10000) / 10000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return Math.round(rounded).toString();
  }
  return rounded.toFixed(3).replace(/\.?0+$/, "");
}
