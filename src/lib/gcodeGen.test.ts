import { describe, expect, it } from "vitest";
import type { HoleOp, Project, SurfacingOp } from "../types/project";
import * as defaults from "../utils/defaults";
import { generateGcode } from "./gcodeGen";

const dummyProject: Project = {
  id: "test-proj",
  name: "Test CNC Project",
  createdAt: 1000,
  updatedAt: 1000,
  settings: {
    stockWidth: "100mm",
    stockHeight: "80mm",
    stockThickness: "12mm",
    zOffset: "0mm",
    safeZ: "5mm",
    defaultFeedRate: "800",
    defaultPlungeRate: "300",
    defaultSpindleRpm: 12000,
    defaultDepthPerPass: "1.5mm",
    defaultStepoverPercent: defaults.defaultStepoverPercent,
  },
  operations: [
    {
      id: "op-1",
      type: "surfacing",
      name: "Top Face",
      enabled: true,
      toolId: "flat-1/4",
      feedRate: "800",
      plungeRate: "300",
      spindleRpm: 12000,
      depthPerPass: "0.5mm",
      x: "0",
      y: "0",
      width: "100mm",
      height: "80mm",
      cutDepth: "1.0mm",
      stepoverPercent: 90,
      pattern: "zigzag-h",
      direction: "forward",
    } as SurfacingOp,
    {
      id: "op-2",
      type: "hole",
      name: "Center Hole",
      enabled: true,
      toolId: "flat-1/8",
      feedRate: "600",
      plungeRate: "200",
      spindleRpm: 14000,
      depthPerPass: "1mm",
      x: "50",
      y: "40",
      diameter: "10mm",
      cutDepth: "6mm",
      peckDepth: "1.5mm",
      direction: "forward",
    } as HoleOp,
  ],
};

describe("gcodeGen", () => {
  it("generates Masso G-code with G21, G90, G30, and M0 tool change pause", () => {
    const result = generateGcode(dummyProject);
    expect(result.gcode).toContain("G21");
    expect(result.gcode).toContain("G90");
    expect(result.gcode).toContain("G30 (Go to park position)");
    expect(result.gcode).toContain("M0 (Manual tool change");
    expect(result.gcode).toContain("M3 S12000");
    expect(result.gcode).toContain("M30 (End of program and rewind)");
    expect(result.totalLines).toBeGreaterThan(20);
  });

  it("handles tool changes between operations with M5 and G30", () => {
    const result = generateGcode(dummyProject);
    // There are 2 different tools ("flat-1/4" then "flat-1/8")
    // Second tool change should stop spindle and park
    expect(result.gcode).toContain("M5 (Spindle off)");
    expect(result.gcode).toContain(
      'Manual tool change: Load 1/8" Flat Endmill',
    );
  });

  it("generates warning when hole diameter < tool diameter", () => {
    const smallHoleProj: Project = {
      ...dummyProject,
      operations: [
        {
          id: "op-bad-hole",
          type: "hole",
          name: "Tiny Hole",
          enabled: true,
          toolId: "flat-1/4", // 6.35mm
          feedRate: "500",
          plungeRate: "200",
          spindleRpm: 12000,
          depthPerPass: "1mm",
          x: "10",
          y: "10",
          diameter: "3mm", // < 6.35mm
          cutDepth: "5mm",
          peckDepth: "1mm",
          direction: "forward",
        } as HoleOp,
      ],
    };
    const result = generateGcode(smallHoleProj);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("smaller than tool diameter");
  });

  it("generates helical spiral arc moves and chip breaking for holes larger than tool", () => {
    const result = generateGcode(dummyProject);
    // op-2 is a 10mm hole cut with a 3.175mm tool -> uses helical spiral arcs
    expect(result.gcode).toContain("G2");
    expect(result.gcode).toMatch(/G2.*Z-.*I/); // G2 spiral arc with Z drop and I offset
    expect(result.gcode).toContain("(Chip break retract)");
    expect(result.gcode).toContain("(Flat bottom cleanup)");
  });
});
