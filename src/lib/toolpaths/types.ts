export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type MoveType = "rapid" | "linear" | "arc-cw" | "arc-ccw";

export interface ToolpathMove {
  type: MoveType;
  x?: number;
  y?: number;
  z?: number;
  i?: number;
  j?: number;
  feedRate?: number;
  comment?: string;
}

export interface GeneratedToolpath {
  opId: string;
  opName: string;
  toolId: string;
  moves: ToolpathMove[];
  estimatedTimeSec?: number;
  minZ: number;
  maxZ: number;
}
