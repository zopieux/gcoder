import type { GlobalSettings, SurfacingOp } from "../../types/project";
import { getToolById } from "../../types/tools";
import * as defaults from "../../utils/defaults";
import { evalDim } from "../exprParser";
import { type BoundingBox2D, generate2DClearingPath } from "./patterns";
import type { GeneratedToolpath, ToolpathMove } from "./types";

export function generateSurfacingToolpath(
  op: SurfacingOp,
  settings: GlobalSettings,
): GeneratedToolpath {
  const tool = getToolById(op.toolId);
  const toolRadius = tool.diameterMm / 2;

  const x = evalDim(op.x, 0);
  const y = evalDim(op.y, 0);
  const width = Math.max(
    0.1,
    evalDim(op.width, evalDim(settings.stockWidth, 100)),
  );
  const height = Math.max(
    0.1,
    evalDim(op.height, evalDim(settings.stockHeight, 75)),
  );
  const totalCutDepth = Math.max(0, evalDim(op.cutDepth, 1.0));
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
    evalDim(op.depthPerPass, evalDim(settings.defaultDepthPerPass, 1.0)),
  );
  const stepoverPercent =
    op.stepoverPercent ||
    settings.defaultStepoverPercent ||
    defaults.defaultStepoverPercent;
  const stepoverMm = Math.max(0.1, tool.diameterMm * (stepoverPercent / 100));

  const moves: ToolpathMove[] = [];

  // Overhang slightly so the surface is completely flat to the edges
  const box: BoundingBox2D = {
    minX: x - toolRadius * 0.6,
    minY: y - toolRadius * 0.6,
    maxX: x + width + toolRadius * 0.6,
    maxY: y + height + toolRadius * 0.6,
  };

  const waypoints2D = generate2DClearingPath(
    box,
    stepoverMm,
    op.pattern,
    op.direction,
  );

  if (waypoints2D.length === 0 || totalCutDepth <= 0) {
    return {
      opId: op.id,
      opName: op.name,
      toolId: op.toolId,
      moves: [],
      minZ: zOffset,
      maxZ: safeZ,
    };
  }

  // Calculate Z passes
  const numPasses = Math.max(1, Math.ceil(totalCutDepth / depthPerPass));
  const actualPassDepth = totalCutDepth / numPasses;

  // Initial move to safe Z
  moves.push({ type: "rapid", z: safeZ, comment: "Retract to safe Z" });

  let currentZ = zOffset;

  for (let pass = 1; pass <= numPasses; pass++) {
    currentZ = zOffset - pass * actualPassDepth;
    const startPoint = waypoints2D[0];

    // Rapid to starting XY above cut
    moves.push({
      type: "rapid",
      x: startPoint.x,
      y: startPoint.y,
      comment: `Pass ${pass}/${numPasses} start XY`,
    });

    // Rapid down to just above material (or safe clearance)
    moves.push({
      type: "rapid",
      z: zOffset + 0.5,
    });

    // Controlled plunge to target pass Z
    moves.push({
      type: "linear",
      z: currentZ,
      feedRate: plungeRate,
      comment: `Plunge to Z=${currentZ.toFixed(3)}`,
    });

    // Mill 2D waypoints at cutting feed rate
    for (let i = 1; i < waypoints2D.length; i++) {
      const pt = waypoints2D[i];
      moves.push({
        type: "linear",
        x: pt.x,
        y: pt.y,
        feedRate,
      });
    }

    // Retract to safe Z between passes if not last
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
