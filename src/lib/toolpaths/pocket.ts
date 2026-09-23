import type { GlobalSettings, PocketOp } from "../../types/project";
import { getToolById } from "../../types/tools";
import * as defaults from "../../utils/defaults";
import { evalDim } from "../exprParser";
import { type BoundingBox2D, generate2DClearingPath } from "./patterns";
import type { GeneratedToolpath, ToolpathMove } from "./types";

export function generatePocketToolpath(
  op: PocketOp,
  settings: GlobalSettings,
): GeneratedToolpath {
  const tool = getToolById(op.toolId);
  const toolRadius = tool.diameterMm / 2;

  const x = evalDim(op.x, 0);
  const y = evalDim(op.y, 0);
  const width = Math.max(0.1, evalDim(op.width, 40));
  const height = Math.max(0.1, evalDim(op.height, 30));
  const totalCutDepth = Math.max(0, evalDim(op.cutDepth, 3));
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
  const stepoverPercent =
    op.stepoverPercent ||
    settings.defaultStepoverPercent ||
    defaults.defaultStepoverPercent;
  const stepoverMm = Math.max(0.1, tool.diameterMm * (stepoverPercent / 100));

  // Critical: account for tool radius so pocket is exact dimension
  const minX = x + toolRadius;
  const maxX = x + width - toolRadius;
  const minY = y + toolRadius;
  const maxY = y + height - toolRadius;

  if (minX > maxX || minY > maxY) {
    // Tool is too wide to fit in pocket
    return {
      opId: op.id,
      opName: op.name,
      toolId: op.toolId,
      moves: [],
      minZ: zOffset,
      maxZ: safeZ,
    };
  }

  const box: BoundingBox2D = { minX, minY, maxX, maxY };
  const clearingPath = generate2DClearingPath(
    box,
    stepoverMm,
    op.pattern,
    op.direction,
  );

  // Perimeter wall cleanup pass
  const perimeter = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];

  const moves: ToolpathMove[] = [];
  const numPasses = Math.max(1, Math.ceil(totalCutDepth / depthPerPass));
  const actualPassDepth = totalCutDepth / numPasses;

  moves.push({ type: "rapid", z: safeZ, comment: "Retract to safe Z" });

  let currentZ = zOffset;

  for (let pass = 1; pass <= numPasses; pass++) {
    currentZ = zOffset - pass * actualPassDepth;
    const start = clearingPath[0] || perimeter[0];

    // Rapid to starting position
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

    // Mill clearing waypoints
    for (let i = 1; i < clearingPath.length; i++) {
      moves.push({
        type: "linear",
        x: clearingPath[i].x,
        y: clearingPath[i].y,
        feedRate,
      });
    }

    // Clean wall finish contour
    moves.push({
      type: "linear",
      x: perimeter[0].x,
      y: perimeter[0].y,
      feedRate,
      comment: "Wall cleanup",
    });
    for (let i = 1; i < perimeter.length; i++) {
      moves.push({
        type: "linear",
        x: perimeter[i].x,
        y: perimeter[i].y,
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
