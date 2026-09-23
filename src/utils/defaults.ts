import type {
  GlobalSettings,
  HoleOp,
  Operation,
  OpType,
  PocketOp,
  ProfilingOp,
  Project,
  SurfacingOp,
} from "../types/project";
import { PREDEFINED_TOOLS } from "../types/tools";

export const defaultStepoverPercent = 90;

export function createDefaultSettings(): GlobalSettings {
  return {
    stockWidth: "100mm",
    stockHeight: "75mm",
    stockThickness: "12.7mm",
    zOffset: "0mm",
    safeZ: "5mm",
    defaultFeedRate: "800",
    defaultPlungeRate: "300",
    defaultSpindleRpm: 12000,
    defaultDepthPerPass: "1.5mm",
    defaultStepoverPercent,
  };
}

export function createDefaultOperation(type: OpType, index = 1): Operation {
  const base = {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    toolId: PREDEFINED_TOOLS[0].id,
    feedRate: "800",
    plungeRate: "300",
    spindleRpm: 12000,
    depthPerPass: "1.5mm",
  };

  switch (type) {
    case "surfacing":
      return {
        ...base,
        type: "surfacing",
        name: `Surfacing ${index}`,
        x: "0mm",
        y: "0mm",
        width: "100mm",
        height: "75mm",
        cutDepth: "0.8mm",
        stepoverPercent: defaultStepoverPercent,
        pattern: "zigzag-h",
        direction: "forward",
      } as SurfacingOp;

    case "profiling":
      return {
        ...base,
        type: "profiling",
        name: `Profiling ${index}`,
        x: "5mm",
        y: "5mm",
        width: "90mm",
        height: "65mm",
        cutDepth: "6.35mm",
        side: "outside",
        direction: "forward",
      } as ProfilingOp;

    case "pocket":
      return {
        ...base,
        type: "pocket",
        name: `Pocket ${index}`,
        x: "20mm",
        y: "15mm",
        width: "60mm",
        height: "45mm",
        cutDepth: "3.5mm",
        stepoverPercent: defaultStepoverPercent,
        pattern: "spiral",
        direction: "forward",
      } as PocketOp;

    case "hole":
      return {
        ...base,
        type: "hole",
        name: `Drill Hole ${index}`,
        toolId: PREDEFINED_TOOLS[1].id, // 1/8" flat
        x: "50mm",
        y: "37.5mm",
        diameter: "1/8in",
        cutDepth: "10mm",
        peckDepth: "2mm",
        direction: "forward",
      } as HoleOp;
  }
}

export function createDefaultProject(name = "New CNC Project"): Project {
  return {
    id: `proj-${Date.now()}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: createDefaultSettings(),
    operations: [],
  };
}
