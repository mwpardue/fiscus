import { describe, expect, it } from "vitest";
import { formatMinorAmountForInput, parseMajorAmountToMinor } from "./money";

describe("parseMajorAmountToMinor", () => {
  it("keeps zero distinct from unknown", () => {
    expect(parseMajorAmountToMinor("0")).toBe(0);
  });

  it("parses dollars and cents into integer minor units", () => {
    expect(parseMajorAmountToMinor("42.17")).toBe(4217);
    expect(parseMajorAmountToMinor("42.1")).toBe(4210);
  });

  it("rejects invalid money input", () => {
    expect(parseMajorAmountToMinor("")).toBeNull();
    expect(parseMajorAmountToMinor("12.345")).toBeNull();
    expect(parseMajorAmountToMinor("-1")).toBeNull();
  });
});

describe("formatMinorAmountForInput", () => {
  it("formats integer minor units as a decimal input value", () => {
    expect(formatMinorAmountForInput(4217)).toBe("42.17");
    expect(formatMinorAmountForInput(0)).toBe("0.00");
  });
});
