import type { Operation, Project } from "../types/project";
import { getToolById } from "../types/tools";
import { evalDim, evalUnitless } from "./exprParser";
import { generateHoleToolpath } from "./toolpaths/hole";
import { generatePocketToolpath } from "./toolpaths/pocket";
import { generateProfilingToolpath } from "./toolpaths/profiling";
import { generateSurfacingToolpath } from "./toolpaths/surfacing";
import type { GeneratedToolpath, ToolpathMove } from "./toolpaths/types";

export interface GcodeOutput {
  gcode: string;
  totalLines: number;
  estimatedTimeMin: number;
  toolpaths: GeneratedToolpath[];
  warnings: string[];
}

export function generateProjectToolpaths(
  project: Project,
): GeneratedToolpath[] {
  const toolpaths: GeneratedToolpath[] = [];

  for (const op of project.operations) {
    if (!op.enabled) continue;

    switch (op.type) {
      case "surfacing":
        toolpaths.push(generateSurfacingToolpath(op, project.settings));
        break;
      case "profiling":
        toolpaths.push(generateProfilingToolpath(op, project.settings));
        break;
      case "pocket":
        toolpaths.push(generatePocketToolpath(op, project.settings));
        break;
      case "hole":
        toolpaths.push(generateHoleToolpath(op, project.settings));
        break;
    }
  }

  return toolpaths;
}

export function generateGcode(project: Project): GcodeOutput {
  const toolpaths = generateProjectToolpaths(project);
  const warnings: string[] = [];
  const lines: string[] = [];

  // Check warnings
  const stockThick = evalDim(project.settings.stockThickness, 12.7);
  for (const op of project.operations) {
    if (!op.enabled) continue;
    const tool = getToolById(op.toolId);

    if (op.type === "hole") {
      const holeDiam = evalDim(op.diameter, tool.diameterMm);
      if (holeDiam < tool.diameterMm - 0.05) {
        warnings.push(
          `Operation "${op.name}": Hole diameter (${holeDiam.toFixed(2)}mm) is smaller than tool diameter (${tool.diameterMm.toFixed(2)}mm).`,
        );
      }
    }

    if (op.type === "pocket") {
      const w = evalDim(op.width, 0);
      const h = evalDim(op.height, 0);
      if (w < tool.diameterMm || h < tool.diameterMm) {
        warnings.push(
          `Operation "${op.name}": Pocket dimensions (${w.toFixed(1)}x${h.toFixed(1)}mm) are smaller than tool diameter (${tool.diameterMm.toFixed(2)}mm).`,
        );
      }
    }

    const cutD = evalDim(op.cutDepth, 0);
    if (cutD > stockThick) {
      warnings.push(
        `Operation "${op.name}": Cut depth (${cutD.toFixed(2)}mm) exceeds stock thickness (${stockThick.toFixed(2)}mm).`,
      );
    }
  }

  const zOffset = evalDim(project.settings.zOffset, 0);
  const safeZ = zOffset + Math.max(1, evalDim(project.settings.safeZ, 5));

  // File Header
  lines.push(`%`);
  lines.push(`(========================================)`);
  lines.push(`( Project: ${project.name} )`);
  lines.push(`( Date: ${new Date().toLocaleString()} )`);
  lines.push(`( Generator: GCoder CNC Toolpath Gen )`);
  lines.push(`( Coordinate System: 0,0 Bottom-Left )`);
  lines.push(
    `( Stock: ${project.settings.stockWidth} x ${project.settings.stockHeight} x ${project.settings.stockThickness} )`,
  );
  lines.push(`(========================================)`);
  lines.push(``);
  lines.push(`G21 (Units: Millimeters)`);
  lines.push(`G90 (Absolute coordinates)`);
  lines.push(`G17 (XY plane selection)`);
  lines.push(`G94 (Feedrate per minute)`);
  lines.push(``);

  let currentToolId: string | null = null;
  let currentFeed = 0;
  let lastX: number | undefined;
  let lastY: number | undefined;
  let lastZ: number | undefined;
  let totalDistanceMm = 0;

  for (let opIndex = 0; opIndex < project.operations.length; opIndex++) {
    const op = project.operations[opIndex];
    if (!op.enabled) continue;

    const tp = toolpaths.find((t) => t.opId === op.id);
    if (!tp || tp.moves.length === 0) continue;

    const tool = getToolById(op.toolId);
    const defaultRpm = evalUnitless(project.settings.defaultSpindleRpm, 12000);
    const spindleRpm = Math.round(evalUnitless(op.spindleRpm, defaultRpm));

    lines.push(``);
    lines.push(`(----------------------------------------)`);
    lines.push(`( Operation ${opIndex + 1}: ${op.name} [${op.type}] )`);
    lines.push(`( Tool: ${tool.name} - Dia: ${tool.diameterMm.toFixed(3)}mm )`);
    lines.push(`(----------------------------------------)`);

    // Manual Tool Change handling
    if (currentToolId !== op.toolId) {
      if (currentToolId !== null) {
        // Spindle stop and park
        lines.push(`M5 (Spindle off)`);
        lines.push(`G0 Z${safeZ.toFixed(3)} (Retract to safe Z)`);
        lines.push(`G30 (Go to park position)`);
      } else {
        // First tool setup
        lines.push(`G0 Z${safeZ.toFixed(3)} (Retract to safe Z)`);
        lines.push(`G30 (Go to park position)`);
      }

      // Manual tool change pause
      lines.push(
        `M0 (Manual tool change: Load ${tool.name} - zero Z on stock top, then resume)`,
      );
      lines.push(`M3 S${spindleRpm} (Spindle ON CW at ${spindleRpm} RPM)`);
      lines.push(`G4 P2.0 (Dwell 2s for spindle spin up)`);
      lines.push(`G0 Z${safeZ.toFixed(3)}`);

      currentToolId = op.toolId;
      lastX = undefined;
      lastY = undefined;
      lastZ = safeZ;
    }

    // Output operation moves
    for (const move of tp.moves) {
      const parts: string[] = [];

      if (move.comment && !move.type) {
        lines.push(`(${move.comment})`);
        continue;
      }

      switch (move.type) {
        case "rapid":
          parts.push("G0");
          break;
        case "linear":
          parts.push("G1");
          break;
        case "arc-cw":
          parts.push("G2");
          break;
        case "arc-ccw":
          parts.push("G3");
          break;
      }

      if (move.x !== undefined && move.x !== lastX) {
        parts.push(`X${move.x.toFixed(3)}`);
        if (lastX !== undefined && lastY !== undefined) {
          const dy = move.y !== undefined ? move.y - lastY : 0;
          totalDistanceMm += Math.hypot(move.x - lastX, dy);
        }
        lastX = move.x;
      }

      if (move.y !== undefined && move.y !== lastY) {
        parts.push(`Y${move.y.toFixed(3)}`);
        lastY = move.y;
      }

      if (move.z !== undefined && move.z !== lastZ) {
        parts.push(`Z${move.z.toFixed(3)}`);
        if (lastZ !== undefined) {
          totalDistanceMm += Math.abs(move.z - lastZ);
        }
        lastZ = move.z;
      }

      if (move.i !== undefined) {
        parts.push(`I${move.i.toFixed(3)}`);
      }
      if (move.j !== undefined) {
        parts.push(`J${move.j.toFixed(3)}`);
      }

      if (
        move.feedRate &&
        move.feedRate !== currentFeed &&
        move.type !== "rapid"
      ) {
        parts.push(`F${Math.round(move.feedRate)}`);
        currentFeed = move.feedRate;
      }

      if (move.comment) {
        parts.push(`(${move.comment})`);
      }

      if (parts.length > 1 || move.comment) {
        lines.push(parts.join(" "));
      }
    }
  }

  // Program End
  lines.push(``);
  lines.push(`(========================================)`);
  lines.push(`( Program End )`);
  lines.push(`(========================================)`);
  lines.push(`M5 (Spindle stop)`);
  lines.push(`G0 Z${safeZ.toFixed(3)} (Retract to safe Z)`);
  lines.push(`G30 (Move all axes to park position)`);
  lines.push(`M30 (End of program and rewind)`);
  lines.push(`%`);

  const gcode = lines.join("\n");
  const estimatedTimeMin = Math.max(
    0.2,
    (totalDistanceMm / (currentFeed || 800)) * 1.2,
  );

  return {
    gcode,
    totalLines: lines.length,
    estimatedTimeMin: Math.round(estimatedTimeMin * 10) / 10,
    toolpaths,
    warnings,
  };
}
