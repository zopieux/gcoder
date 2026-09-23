import type { MillingPattern, ToolpathDirection } from "../../types/project";
import type { Point2D } from "./types";

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Generates a sequence of 2D waypoints to clear a rectangular area [minX..maxX, minY..maxY]
 * using the specified pattern and stepover distance.
 */
export function generate2DClearingPath(
  box: BoundingBox2D,
  stepoverMm: number,
  pattern: MillingPattern,
  direction: ToolpathDirection = "forward",
): Point2D[] {
  const { minX, minY, maxX, maxY } = box;
  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0 || stepoverMm <= 0) {
    return [];
  }

  let points: Point2D[] = [];

  switch (pattern) {
    case "zigzag-h":
      points = generateZigzagH(box, stepoverMm);
      break;
    case "zigzag-v":
      points = generateZigzagV(box, stepoverMm);
      break;
    case "zigzag-diag":
      points = generateZigzagDiag(box, stepoverMm);
      break;
    case "spiral":
      points = generateSpiral(box, stepoverMm);
      break;
    default:
      points = generateZigzagH(box, stepoverMm);
  }

  if (direction === "reversed") {
    points.reverse();
  }

  return points;
}

function generateZigzagH(box: BoundingBox2D, stepover: number): Point2D[] {
  const { minX, minY, maxX, maxY } = box;
  const points: Point2D[] = [];

  const ySteps = Math.max(1, Math.ceil((maxY - minY) / stepover));
  const actualStep = (maxY - minY) / ySteps;

  for (let i = 0; i <= ySteps; i++) {
    const y = Math.min(maxY, minY + i * actualStep);
    if (i % 2 === 0) {
      // Left to right
      points.push({ x: minX, y });
      points.push({ x: maxX, y });
    } else {
      // Right to left
      points.push({ x: maxX, y });
      points.push({ x: minX, y });
    }
  }

  return points;
}

function generateZigzagV(box: BoundingBox2D, stepover: number): Point2D[] {
  const { minX, minY, maxX, maxY } = box;
  const points: Point2D[] = [];

  const xSteps = Math.max(1, Math.ceil((maxX - minX) / stepover));
  const actualStep = (maxX - minX) / xSteps;

  for (let i = 0; i <= xSteps; i++) {
    const x = Math.min(maxX, minX + i * actualStep);
    if (i % 2 === 0) {
      // Bottom to top
      points.push({ x, y: minY });
      points.push({ x, y: maxY });
    } else {
      // Top to bottom
      points.push({ x, y: maxY });
      points.push({ x, y: minY });
    }
  }

  return points;
}

function generateZigzagDiag(box: BoundingBox2D, stepover: number): Point2D[] {
  const { minX, minY, maxX, maxY } = box;
  const points: Point2D[] = [];

  // Diagonal 45-degree lines: x + y = c
  // Range of c: (minX + minY) to (maxX + maxY)
  const cMin = minX + minY;
  const cMax = maxX + maxY;
  // Effective perpendicular spacing for 45 deg: stepover * sqrt(2)
  const cStep = stepover * Math.SQRT2;
  const steps = Math.max(1, Math.ceil((cMax - cMin) / cStep));
  const actualCStep = (cMax - cMin) / steps;

  let flip = false;
  for (let i = 0; i <= steps; i++) {
    const c = cMin + i * actualCStep;

    // Intersect line x + y = c with box [minX..maxX] x [minY..maxY]
    // y = c - x
    const segPoints: Point2D[] = [];

    // Left edge (x = minX)
    const yLeft = c - minX;
    if (yLeft >= minY && yLeft <= maxY) {
      segPoints.push({ x: minX, y: yLeft });
    }

    // Bottom edge (y = minY)
    const xBottom = c - minY;
    if (xBottom >= minX && xBottom <= maxX) {
      if (
        !segPoints.some(
          (p) => Math.abs(p.x - xBottom) < 1e-4 && Math.abs(p.y - minY) < 1e-4,
        )
      ) {
        segPoints.push({ x: xBottom, y: minY });
      }
    }

    // Right edge (x = maxX)
    const yRight = c - maxX;
    if (yRight >= minY && yRight <= maxY) {
      if (
        !segPoints.some(
          (p) => Math.abs(p.x - maxX) < 1e-4 && Math.abs(p.y - yRight) < 1e-4,
        )
      ) {
        segPoints.push({ x: maxX, y: yRight });
      }
    }

    // Top edge (y = maxY)
    const xTop = c - maxY;
    if (xTop >= minX && xTop <= maxX) {
      if (
        !segPoints.some(
          (p) => Math.abs(p.x - xTop) < 1e-4 && Math.abs(p.y - maxY) < 1e-4,
        )
      ) {
        segPoints.push({ x: xTop, y: maxY });
      }
    }

    if (segPoints.length >= 2) {
      // Sort points along the diagonal
      segPoints.sort((a, b) => a.x - b.x);
      const p1 = flip ? segPoints[segPoints.length - 1] : segPoints[0];
      const p2 = flip ? segPoints[0] : segPoints[segPoints.length - 1];
      points.push(p1, p2);
      flip = !flip;
    } else if (segPoints.length === 1) {
      points.push(segPoints[0]);
    }
  }

  return points.length > 0
    ? points
    : [
        { x: minX, y: minY },
        { x: maxX, y: maxY },
      ];
}

function generateSpiral(box: BoundingBox2D, stepover: number): Point2D[] {
  let { minX, minY, maxX, maxY } = box;
  const loops: Point2D[][] = [];

  while (maxX > minX + 1e-3 && maxY > minY + 1e-3) {
    const loop: Point2D[] = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      { x: minX, y: minY }, // close loop
    ];
    loops.push(loop);

    minX += stepover;
    minY += stepover;
    maxX -= stepover;
    maxY -= stepover;
  }

  // If there's a center point/segment remaining
  if (minX <= maxX && minY <= maxY) {
    loops.push([{ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }]);
  }

  const result: Point2D[] = [];
  for (const loop of loops) {
    result.push(...loop);
  }

  return result;
}
