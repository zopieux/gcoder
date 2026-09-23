import type { GlobalSettings, ProfilingOp } from "../../types/project";
import { getToolById } from "../../types/tools";
import { evalDim } from "../exprParser";
import type { GeneratedToolpath, ToolpathMove } from "./types";

export function generateProfilingToolpath(
  op: ProfilingOp,
  settings: GlobalSettings,
): GeneratedToolpath {
  const tool = getToolById(op.toolId);
  const toolRadius = tool.diameterMm / 2;

  const x = evalDim(op.x, 0);
  const y = evalDim(op.y, 0);
  const width = Math.max(0.1, evalDim(op.width, 50));
  const height = Math.max(0.1, evalDim(op.height, 50));
  const totalCutDepth = Math.max(0, evalDim(op.cutDepth, 5));
  const zOffset = evalDim(settings.zOffset, 0);
  const safeZ = zOffset + Math.max(1, evalDim(settings.safeZ, 5));

  const feedRate = Math.max(
    50,
    evalDim(op.feedRate, evalDim(settings.defaultFeedRate, 800)),
  );
  const plungeRate = Math.max(
    20,
    evalDim(op.plungeRate, evalDim(settings.defaultPlungeRate, 300)),
  );
  const depthPerPass = Math.max(
    0.1,
    evalDim(op.depthPerPass, evalDim(settings.defaultDepthPerPass, 1.5)),
  );

  let minX: number;
  let maxX: number;
  let minY: number;
  let maxY: number;

  if (op.side === "outside") {
    minX = x - toolRadius;
    maxX = x + width + toolRadius;
    minY = y - toolRadius;
    maxY = y + height + toolRadius;
  } else {
    // inside profiling
    minX = x + toolRadius;
    maxX = x + width - toolRadius;
    minY = y + toolRadius;
    maxY = y + height - toolRadius;
  }

  // Check if inside cut is viable
  if (minX > maxX || minY > maxY) {
    return {
      opId: op.id,
      opName: op.name,
      toolId: op.toolId,
      moves: [],
      minZ: zOffset,
      maxZ: safeZ,
    };
  }

  // 4 corners of rectangle contour: bottom-left -> bottom-right -> top-right -> top-left -> bottom-left
  let contour = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];

  if (op.direction === "reversed") {
    contour = [
      { x: minX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY },
      { x: maxX, y: minY },
      { x: minX, y: minY },
    ];
  }

  const moves: ToolpathMove[] = [];
  const numPasses = Math.max(1, Math.ceil(totalCutDepth / depthPerPass));
  const actualPassDepth = totalCutDepth / numPasses;

  moves.push({ type: "rapid", z: safeZ, comment: "Retract to safe Z" });

  let currentZ = zOffset;

  for (let pass = 1; pass <= numPasses; pass++) {
    currentZ = zOffset - pass * actualPassDepth;
    const start = contour[0];

    // Rapid to start position
    moves.push({
      type: "rapid",
      x: start.x,
      y: start.y,
      comment: `Pass ${pass}/${numPasses} start`,
    });

    moves.push({ type: "rapid", z: zOffset + 0.5 });
    moves.push({
      type: "linear",
      z: currentZ,
      feedRate: plungeRate,
      comment: `Plunge to Z=${currentZ.toFixed(3)}`,
    });

    // Mill around contour
    for (let i = 1; i < contour.length; i++) {
      moves.push({
        type: "linear",
        x: contour[i].x,
        y: contour[i].y,
        feedRate,
      });
    }

    moves.push({
      type: "rapid",
      z: safeZ,
      comment: `Retract after pass ${pass}`,
    });
  }

  return {
    opId: op.id,
    opName: op.name,
    toolId: op.toolId,
    moves,
    minZ: zOffset - totalCutDepth,
    maxZ: safeZ,
  };
}
