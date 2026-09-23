export type OpType = "surfacing" | "profiling" | "pocket" | "hole";

export type MillingPattern =
  | "zigzag-h" // Horizontal zigzag (parallel to X)
  | "zigzag-v" // Vertical zigzag (parallel to Y)
  | "zigzag-diag" // 45 degree diagonal zigzag
  | "spiral"; // Spiral (direction toggle controls inside-out vs outside-in)

export type ToolpathDirection = "forward" | "reversed";

export type ProfileSide = "outside" | "inside";

export interface BaseOp {
  id: string;
  type: OpType;
  name: string;
  enabled: boolean;
  toolId: string;
  // Overrides for feeds/speeds (expression or number string)
  feedRate: string; // e.g. "800" (mm/min)
  plungeRate: string; // e.g. "300" (mm/min)
  spindleRpm: string | number; // e.g. 12000 or "12*1000"
  depthPerPass: string; // e.g. "1.5mm" or "1/16in"
}

export interface SurfacingOp extends BaseOp {
  type: "surfacing";
  // Bounding rectangle
  x: string; // Bottom-left corner X
  y: string; // Bottom-left corner Y
  width: string; // Width in X
  height: string; // Height in Y
  cutDepth: string; // Total depth to remove (>0, cuts down)
  stepoverPercent: number; // e.g. 40 (%)
  pattern: MillingPattern;
  direction: ToolpathDirection;
}

export interface ProfilingOp extends BaseOp {
  type: "profiling";
  x: string; // Rectangle bottom-left corner X
  y: string; // Rectangle bottom-left corner Y
  width: string; // Width in X
  height: string; // Height in Y
  cutDepth: string; // Total cut depth
  side: ProfileSide; // Outside or Inside
  direction: ToolpathDirection; // Forward (climb/conventional) vs Reversed
  cornerRadius?: string; // Optional corner rounding
}

export interface PocketOp extends BaseOp {
  type: "pocket";
  x: string; // Rectangle bottom-left corner X
  y: string; // Rectangle bottom-left corner Y
  width: string; // Width in X
  height: string; // Height in Y
  cutDepth: string; // Total cut depth
  stepoverPercent: number; // e.g. 40 (%)
  pattern: MillingPattern;
  direction: ToolpathDirection;
  cornerRadius?: string; // Optional corner radius
}

export interface HoleOp extends BaseOp {
  type: "hole";
  x: string; // Hole center X
  y: string; // Hole center Y
  diameter: string; // Hole diameter
  cutDepth: string; // Total hole depth
  peckDepth: string; // Peck increment (0 or empty = direct plunge)
  direction: ToolpathDirection; // CW vs CCW if circular interpolation
}

export type Operation = SurfacingOp | ProfilingOp | PocketOp | HoleOp;

export interface GlobalSettings {
  stockWidth: string; // e.g. "100mm" or "4in"
  stockHeight: string; // e.g. "75mm" or "3in"
  stockThickness: string; // e.g. "12.7mm" or "1/2in"
  zOffset: string; // e.g. "0mm" offset from top surface
  safeZ: string; // e.g. "5mm" or "1/4in"
  defaultFeedRate: string; // e.g. "800"
  defaultPlungeRate: string; // e.g. "300"
  defaultSpindleRpm: string | number; // e.g. 12000 or "12*1000"
  defaultDepthPerPass: string; // e.g. "1.5mm"
  defaultStepoverPercent: number; // e.g. 40
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: GlobalSettings;
  operations: Operation[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  opCount: number;
}
