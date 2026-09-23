import type { GlobalSettings, HoleOp } from "../../types/project";
import { getToolById } from "../../types/tools";
import { evalDim } from "../exprParser";
import type { GeneratedToolpath, ToolpathMove } from "./types";

export function generateHoleToolpath(
  op: HoleOp,
  settings: GlobalSettings,
): GeneratedToolpath {
  const tool = getToolById(op.toolId);
  const toolDiameter = tool.diameterMm;

  const cx = evalDim(op.x, 0);
  const cy = evalDim(op.y, 0);
  const holeDiameter = evalDim(op.diameter, toolDiameter);
  const totalCutDepth = Math.max(0, evalDim(op.cutDepth, 5));
  const peckDepth = Math.max(0, evalDim(op.peckDepth, 0));
  const zOffset = evalDim(settings.zOffset, 0);
  const safeZ = zOffset + Math.max(1, evalDim(settings.safeZ, 5));

  const feedRate = Math.max(
    50,
    evalDim(op.feedRate, evalDim(settings.defaultFeedRate, 800)),
  );
  const plungeRate = Math.max(
    20,
    evalDim(op.plungeRate, evalDim(settings.defaultPlungeRate, 250)),
  );
  const depthPerPass = Math.max(
    0.1,
    evalDim(op.depthPerPass, evalDim(settings.defaultDepthPerPass, 1.5)),
  );

  const moves: ToolpathMove[] = [];

  // Hole smaller than tool - invalid
  if (holeDiameter < toolDiameter - 0.05) {
    return {
      opId: op.id,
      opName: op.name,
      toolId: op.toolId,
      moves: [],
      minZ: zOffset,
      maxZ: safeZ,
    };
  }

  // Initial move to safe Z above hole center
  moves.push({ type: "rapid", z: safeZ, comment: "Retract to safe Z" });
  moves.push({ type: "rapid", x: cx, y: cy, comment: "Hole center" });

  // Case A: Direct plunge or peck drill when hole diameter equals tool diameter
  if (Math.abs(holeDiameter - toolDiameter) <= 0.1) {
    if (peckDepth > 0) {
      // Peck drilling
      const pecks = Math.ceil(totalCutDepth / peckDepth);
      for (let p = 1; p <= pecks; p++) {
        const targetZ = zOffset - Math.min(totalCutDepth, p * peckDepth);
        moves.push({
          type: "linear",
          z: targetZ,
          feedRate: plungeRate,
          comment: `Peck ${p}/${pecks} to Z=${targetZ.toFixed(3)}`,
        });
        // Chip break retract
        moves.push({
          type: "rapid",
          z: zOffset + 1.0,
          comment: "Chip break retract",
        });
        if (p < pecks) {
          moves.push({ type: "rapid", z: targetZ + 0.3 });
        }
      }
    } else {
      // Single continuous plunge
      moves.push({
        type: "linear",
        z: zOffset - totalCutDepth,
        feedRate: plungeRate,
        comment: "Direct plunge drill",
      });
    }

    moves.push({ type: "rapid", z: safeZ, comment: "Retract after drill" });

    return {
      opId: op.id,
      opName: op.name,
      toolId: op.toolId,
      moves,
      minZ: zOffset - totalCutDepth,
      maxZ: safeZ,
    };
  }

  // Case B: Hole diameter > tool diameter -> Helical spiral ramping (Spiral Arc)
  const orbitRadius = (holeDiameter - toolDiameter) / 2;
  const targetZ = zOffset - totalCutDepth;

  // Helical pitch per full 360-degree revolution
  const pitchPerTurn = Math.max(0.1, depthPerPass);
  const totalTurns = Math.max(1, Math.ceil(totalCutDepth / pitchPerTurn));
  const actualPitch = totalCutDepth / totalTurns;

  // Rapid down to clearance above hole
  moves.push({ type: "rapid", z: zOffset + 0.5 });

  // Lead into start of circle at zOffset
  moves.push({
    type: "linear",
    x: cx + orbitRadius,
    y: cy,
    feedRate: plungeRate,
    comment: "Lead to helical start",
  });

  let currentZ = zOffset;
  let depthSinceLastPeck = 0;

  for (let turn = 1; turn <= totalTurns; turn++) {
    const nextZ = zOffset - turn * actualPitch;
    const midZ = (currentZ + nextZ) / 2;

    if (op.direction === "reversed") {
      // CCW (G3)
      moves.push({
        type: "arc-ccw",
        x: cx - orbitRadius,
        y: cy,
        z: midZ,
        i: -orbitRadius,
        j: 0,
        feedRate,
        comment: `Helical turn ${turn}/${totalTurns} (half)`,
      });
      moves.push({
        type: "arc-ccw",
        x: cx + orbitRadius,
        y: cy,
        z: nextZ,
        i: orbitRadius,
        j: 0,
        feedRate,
      });
    } else {
      // CW (G2 - climb milling standard)
      moves.push({
        type: "arc-cw",
        x: cx - orbitRadius,
        y: cy,
        z: midZ,
        i: -orbitRadius,
        j: 0,
        feedRate,
        comment: `Helical turn ${turn}/${totalTurns} (half)`,
      });
      moves.push({
        type: "arc-cw",
        x: cx + orbitRadius,
        y: cy,
        z: nextZ,
        i: orbitRadius,
        j: 0,
        feedRate,
      });
    }

    currentZ = nextZ;
    depthSinceLastPeck += actualPitch;

    // Chip-breaking movement if peckDepth > 0
    if (peckDepth > 0 && depthSinceLastPeck >= peckDepth && turn < totalTurns) {
      depthSinceLastPeck = 0;
      const retractZ = Math.min(zOffset + 0.5, currentZ + 0.8);
      moves.push({
        type: "rapid",
        z: retractZ,
        comment: "Chip break retract",
      });
      moves.push({
        type: "rapid",
        z: currentZ,
      });
    }
  }

  // Flat bottom cleanup pass (full 360-degree circle at targetZ without Z drop)
  if (op.direction === "reversed") {
    moves.push({
      type: "arc-ccw",
      x: cx - orbitRadius,
      y: cy,
      z: targetZ,
      i: -orbitRadius,
      j: 0,
      feedRate,
      comment: "Flat bottom cleanup",
    });
    moves.push({
      type: "arc-ccw",
      x: cx + orbitRadius,
      y: cy,
      z: targetZ,
      i: orbitRadius,
      j: 0,
      feedRate,
    });
  } else {
    moves.push({
      type: "arc-cw",
      x: cx - orbitRadius,
      y: cy,
      z: targetZ,
      i: -orbitRadius,
      j: 0,
      feedRate,
      comment: "Flat bottom cleanup",
    });
    moves.push({
      type: "arc-cw",
      x: cx + orbitRadius,
      y: cy,
      z: targetZ,
      i: orbitRadius,
      j: 0,
      feedRate,
    });
  }

  // Smooth lead-out back to hole center
  moves.push({
    type: "linear",
    x: cx,
    y: cy,
    feedRate,
    comment: "Lead out to center",
  });

  // Rapid retract to safe Z
  moves.push({ type: "rapid", z: safeZ, comment: "Retract to safe Z" });

  return {
    opId: op.id,
    opName: op.name,
    toolId: op.toolId,
    moves,
    minZ: targetZ,
    maxZ: safeZ,
  };
}
