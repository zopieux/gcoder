export type ToolProfile = "flat" | "v45" | "v60";

export interface ToolDef {
  id: string;
  name: string;
  diameterMm: number;
  diameterExpr: string;
  profile: ToolProfile;
  flutes?: number;
  description: string;
}

export const PREDEFINED_TOOLS: ToolDef[] = [
  {
    id: "flat-1/4",
    name: '1/4" Flat Endmill',
    diameterMm: 25.4 / 4, // 6.35 mm
    diameterExpr: "1/4in",
    profile: "flat",
    description: "6.35mm (0.25in) Flat Endmill",
  },
  {
    id: "flat-1/8",
    name: '1/8" Flat Endmill',
    diameterMm: 25.4 / 8, // 3.175 mm
    diameterExpr: "1/8in",
    profile: "flat",
    description: "3.175mm (0.125in) Flat Endmill",
  },
  {
    id: "flat-1/16",
    name: '1/16" Flat Endmill',
    diameterMm: 25.4 / 16, // 1.5875 mm
    diameterExpr: "1/16in",
    profile: "flat",
    description: "1.5875mm (0.0625in) Flat Endmill",
  },
  {
    id: "v45-1/4",
    name: '1/4" V-Bit 45°',
    diameterMm: 25.4 / 4,
    diameterExpr: "1/4in",
    profile: "v45",
    description: "6.35mm (0.25in) 45° Chamfer / V-Bit",
  },
  {
    id: "v45-1/8",
    name: '1/8" V-Bit 45°',
    diameterMm: 25.4 / 8,
    diameterExpr: "1/8in",
    profile: "v45",
    description: "3.175mm (0.125in) 45° Chamfer / V-Bit",
  },
  {
    id: "v45-1/16",
    name: '1/16" V-Bit 45°',
    diameterMm: 25.4 / 16,
    diameterExpr: "1/16in",
    profile: "v45",
    description: "1.5875mm (0.0625in) 45° Chamfer / V-Bit",
  },
  {
    id: "v60-1/4",
    name: '1/4" V-Bit 60°',
    diameterMm: 25.4 / 4,
    diameterExpr: "1/4in",
    profile: "v60",
    description: "6.35mm (0.25in) 60° V-Carve / Engraving Bit",
  },
  {
    id: "v60-1/8",
    name: '1/8" V-Bit 60°',
    diameterMm: 25.4 / 8,
    diameterExpr: "1/8in",
    profile: "v60",
    description: "3.175mm (0.125in) 60° V-Carve / Engraving Bit",
  },
  {
    id: "v60-1/16",
    name: '1/16" V-Bit 60°',
    diameterMm: 25.4 / 16,
    diameterExpr: "1/16in",
    profile: "v60",
    description: "1.5875mm (0.0625in) 60° V-Carve / Engraving Bit",
  },
];

export function getToolById(id: string): ToolDef {
  return PREDEFINED_TOOLS.find((t) => t.id === id) || PREDEFINED_TOOLS[0];
}
