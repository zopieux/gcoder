import { describe, expect, it } from "vitest";
import {
  evalDim,
  evalUnitless,
  parseDimension,
  parseUnitless,
} from "./exprParser";

describe("exprParser", () => {
  it("parses single numbers with implicit mm", () => {
    expect(parseDimension("10").value).toBeCloseTo(10);
    expect(parseDimension("0.5").value).toBeCloseTo(0.5);
    expect(parseDimension("25.4").value).toBeCloseTo(25.4);
  });

  it("parses numbers with explicit mm unit", () => {
    expect(parseDimension("10mm").value).toBeCloseTo(10);
    expect(parseDimension("12.7 mm").value).toBeCloseTo(12.7);
  });

  it("parses numbers with inch units", () => {
    expect(parseDimension("1in").value).toBeCloseTo(25.4);
    expect(parseDimension("1 inch").value).toBeCloseTo(25.4);
    expect(parseDimension('1"').value).toBeCloseTo(25.4);
    expect(parseDimension("0.25in").value).toBeCloseTo(6.35);
  });

  it("parses fractions with units", () => {
    expect(parseDimension("1/4in").value).toBeCloseTo(6.35);
    expect(parseDimension("1/8in").value).toBeCloseTo(3.175);
    expect(parseDimension("1/16in").value).toBeCloseTo(1.5875);
    expect(parseDimension("1/32in").value).toBeCloseTo(0.79375);
    expect(parseDimension("3/4mm").value).toBeCloseTo(0.75);
  });

  it("parses prompt examples correctly", () => {
    // "1+6-3/4mm" -> 1 (mm) + 6 (mm) - 0.75 (mm) = 6.25
    expect(parseDimension("1+6-3/4mm").value).toBeCloseTo(6.25);

    // "1mm - 1/32in" -> 1 - (1/32 * 25.4) = 1 - 0.79375 = 0.20625
    expect(parseDimension("1mm - 1/32in").value).toBeCloseTo(0.20625);
  });

  it("parses mixed fractions like '1 1/2in'", () => {
    expect(parseDimension("1 1/2in").value).toBeCloseTo(38.1);
    expect(parseDimension("2 1/4in").value).toBeCloseTo(57.15);
  });

  it("handles parentheses and mixed operations", () => {
    expect(parseDimension("(2 + 1/2)in - 5mm").value).toBeCloseTo(58.5);
    expect(parseDimension("3 * 1/8in").value).toBeCloseTo(9.525);
    expect(parseDimension("10 - 2 * 3mm").value).toBeCloseTo(4);
  });

  it("handles negative numbers", () => {
    expect(parseDimension("-5mm").value).toBeCloseTo(-5);
    expect(parseDimension("10 - 15").value).toBeCloseTo(-5);
  });

  it("returns error on invalid syntax", () => {
    expect(parseDimension("abc").error).toBeDefined();
    expect(parseDimension("10 / 0").error).toBe("Division by zero");
    expect(parseDimension("").error).toBeDefined();
  });

  it("evalDim helper returns fallback on error", () => {
    expect(evalDim("invalid", 42)).toBe(42);
    expect(evalDim("1/4in", 0)).toBeCloseTo(6.35);
  });

  describe("parseUnitless", () => {
    it("parses pure arithmetic expressions like 12*1000", () => {
      expect(parseUnitless("12*1000").value).toBe(12000);
      expect(parseUnitless("12 * 1000").value).toBe(12000);
      expect(parseUnitless("24000 / 2").value).toBe(12000);
      expect(parseUnitless("(10 + 2) * 1000").value).toBe(12000);
      expect(parseUnitless("15000 - 3000").value).toBe(12000);
    });

    it("rejects units in unitless mode", () => {
      expect(parseUnitless("12000rpm").error).toBeDefined();
      expect(parseUnitless("12 * 1000 rpm").error).toBeDefined();
      expect(parseUnitless("10mm").error).toBeDefined();
      expect(parseUnitless("1/4in").error).toBeDefined();
      expect(parseUnitless('12"').error).toBeDefined();
    });

    it("evalUnitless helper returns fallback on error", () => {
      expect(evalUnitless("invalid", 12000)).toBe(12000);
      expect(evalUnitless("12000rpm", 10000)).toBe(10000);
      expect(evalUnitless("12 * 1000", 0)).toBe(12000);
    });
  });
});
