import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { GlobalSettings, Operation } from "../../types/project";
import { getToolById } from "../../types/tools";
import { evalDim } from "../exprParser";

export interface PreviewMeshes {
  remainingStock: THREE.Mesh;
  cutVolume?: THREE.Object3D;
  wireframes?: THREE.LineSegments[];
  warning?: string;
}

const evaluator = new Evaluator();
evaluator.useGroups = false;

// Shared materials
const remainingMaterial = new THREE.MeshStandardMaterial({
  color: 0x2563eb, // Clean CNC anodized blue
  roughness: 0.4,
  metalness: 0.3,
  flatShading: false,
  polygonOffset: true,
  polygonOffsetFactor: 1.0,
  polygonOffsetUnits: 1.0,
});

const cutMaterial = new THREE.MeshStandardMaterial({
  color: 0xf59e0b, // Amber / warm semitransparent removed material
  transparent: true,
  opacity: 0.38,
  roughness: 0.25,
  metalness: 0.1,
  side: THREE.FrontSide, // FrontSide prevents back-face internal triangle collision
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1.0,
  polygonOffsetUnits: -4.0,
});

const edgeMaterial = new THREE.LineBasicMaterial({
  color: 0x1d4ed8,
  transparent: true,
  opacity: 0.8,
});

const cutEdgeMaterial = new THREE.LineBasicMaterial({
  color: 0xd97706,
  transparent: true,
  opacity: 0.9,
});

// Height extension above Z=0 for clean CSG boolean cutting
const CSG_EPSILON = 0.2;

/**
 * Creates clean 12-edge box wireframe with zero internal triangulation lines.
 */
function createBoxWireframe(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  zTop: number,
  zBottom: number,
  material: THREE.Material,
): THREE.LineSegments {
  const pts: THREE.Vector3[] = [
    // Top rectangle
    new THREE.Vector3(minX, minY, zTop),
    new THREE.Vector3(maxX, minY, zTop),
    new THREE.Vector3(maxX, minY, zTop),
    new THREE.Vector3(maxX, maxY, zTop),
    new THREE.Vector3(maxX, maxY, zTop),
    new THREE.Vector3(minX, maxY, zTop),
    new THREE.Vector3(minX, maxY, zTop),
    new THREE.Vector3(minX, minY, zTop),
    // Bottom rectangle
    new THREE.Vector3(minX, minY, zBottom),
    new THREE.Vector3(maxX, minY, zBottom),
    new THREE.Vector3(maxX, minY, zBottom),
    new THREE.Vector3(maxX, maxY, zBottom),
    new THREE.Vector3(maxX, maxY, zBottom),
    new THREE.Vector3(minX, maxY, zBottom),
    new THREE.Vector3(minX, maxY, zBottom),
    new THREE.Vector3(minX, minY, zBottom),
    // 4 vertical edges
    new THREE.Vector3(minX, minY, zTop),
    new THREE.Vector3(minX, minY, zBottom),
    new THREE.Vector3(maxX, minY, zTop),
    new THREE.Vector3(maxX, minY, zBottom),
    new THREE.Vector3(maxX, maxY, zTop),
    new THREE.Vector3(maxX, maxY, zBottom),
    new THREE.Vector3(minX, maxY, zTop),
    new THREE.Vector3(minX, maxY, zBottom),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineSegments(geo, material);
}

/**
 * Creates clean cylinder wireframe with top/bottom rims and 4 vertical lines (no diagonals).
 */
function createCylinderWireframe(
  cx: number,
  cy: number,
  radius: number,
  zTop: number,
  zBottom: number,
  segments = 48,
  material: THREE.Material,
): THREE.LineSegments {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);

    // Top rim
    pts.push(new THREE.Vector3(x1, y1, zTop), new THREE.Vector3(x2, y2, zTop));
    // Bottom rim
    pts.push(
      new THREE.Vector3(x1, y1, zBottom),
      new THREE.Vector3(x2, y2, zBottom),
    );

    // 4 vertical quadrant lines
    if (i % (segments / 4) === 0) {
      pts.push(
        new THREE.Vector3(x1, y1, zTop),
        new THREE.Vector3(x1, y1, zBottom),
      );
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineSegments(geo, material);
}

/**
 * Creates the stock base brush.
 */
export function createStockBrush(settings: GlobalSettings): {
  brush: Brush;
  w: number;
  h: number;
  t: number;
} {
  const w = Math.max(1, evalDim(settings.stockWidth, 100));
  const h = Math.max(1, evalDim(settings.stockHeight, 75));
  const t = Math.max(0.5, evalDim(settings.stockThickness, 12.7));

  const geo = new THREE.BoxGeometry(w, h, t);
  geo.translate(w / 2, h / 2, -t / 2);

  const brush = new Brush(geo, remainingMaterial);
  brush.updateMatrixWorld();
  return { brush, w, h, t };
}

/**
 * Builds the CSG subtraction cutter brush for an operation.
 */
export function buildCutterBrush(
  op: Operation,
  settings: GlobalSettings,
): Brush | null {
  const tool = getToolById(op.toolId);
  const toolDiam = tool.diameterMm;
  const stockW = Math.max(1, evalDim(settings.stockWidth, 100));
  const stockH = Math.max(1, evalDim(settings.stockHeight, 75));
  const stockT = Math.max(0.5, evalDim(settings.stockThickness, 12.7));

  switch (op.type) {
    case "surfacing": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, stockW));
      const height = Math.max(0.1, evalDim(op.height, stockH));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT, evalDim(op.cutDepth, 1)),
      );

      const csgHeight = cutDepth + CSG_EPSILON;
      const csgGeo = new THREE.BoxGeometry(width, height, csgHeight);
      csgGeo.translate(
        x + width / 2,
        y + height / 2,
        (CSG_EPSILON - cutDepth) / 2,
      );

      const brush = new Brush(csgGeo);
      brush.updateMatrixWorld();
      return brush;
    }

    case "profiling": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, 50));
      const height = Math.max(0.1, evalDim(op.height, 50));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT + 1, evalDim(op.cutDepth, 5)),
      );
      const csgHeight = cutDepth + CSG_EPSILON;

      let outerMinX: number,
        outerMaxX: number,
        outerMinY: number,
        outerMaxY: number;
      let innerMinX: number,
        innerMaxX: number,
        innerMinY: number,
        innerMaxY: number;

      if (op.side === "outside") {
        outerMinX = x - toolDiam;
        outerMaxX = x + width + toolDiam;
        outerMinY = y - toolDiam;
        outerMaxY = y + height + toolDiam;
        innerMinX = x;
        innerMaxX = x + width;
        innerMinY = y;
        innerMaxY = y + height;
      } else {
        outerMinX = x;
        outerMaxX = x + width;
        outerMinY = y;
        outerMaxY = y + height;
        innerMinX = Math.min(x + width / 2, x + toolDiam);
        innerMaxX = Math.max(x + width / 2, x + width - toolDiam);
        innerMinY = Math.min(y + height / 2, y + toolDiam);
        innerMaxY = Math.max(y + height / 2, y + height - toolDiam);
      }

      const outerW = outerMaxX - outerMinX;
      const outerH = outerMaxY - outerMinY;
      const innerW = Math.max(0.01, innerMaxX - innerMinX);
      const innerH = Math.max(0.01, innerMaxY - innerMinY);

      const outerGeo = new THREE.BoxGeometry(outerW, outerH, csgHeight);
      outerGeo.translate(
        (outerMinX + outerMaxX) / 2,
        (outerMinY + outerMaxY) / 2,
        (CSG_EPSILON - cutDepth) / 2,
      );
      const outerBrush = new Brush(outerGeo);
      outerBrush.updateMatrixWorld();

      const innerGeo = new THREE.BoxGeometry(innerW, innerH, csgHeight + 0.5);
      innerGeo.translate(
        (innerMinX + innerMaxX) / 2,
        (innerMinY + innerMaxY) / 2,
        (CSG_EPSILON - cutDepth) / 2,
      );
      const innerBrush = new Brush(innerGeo);
      innerBrush.updateMatrixWorld();

      try {
        const brush = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
        brush.updateMatrixWorld();
        return brush;
      } catch {
        return outerBrush;
      }
    }

    case "pocket": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, 40));
      const height = Math.max(0.1, evalDim(op.height, 30));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT, evalDim(op.cutDepth, 3)),
      );

      const csgHeight = cutDepth + CSG_EPSILON;
      const csgGeo = new THREE.BoxGeometry(width, height, csgHeight);
      csgGeo.translate(
        x + width / 2,
        y + height / 2,
        (CSG_EPSILON - cutDepth) / 2,
      );

      const brush = new Brush(csgGeo);
      brush.updateMatrixWorld();
      return brush;
    }

    case "hole": {
      const cx = evalDim(op.x, stockW / 2);
      const cy = evalDim(op.y, stockH / 2);
      const holeDiam = Math.max(0.1, evalDim(op.diameter, toolDiam));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT + 2, evalDim(op.cutDepth, 5)),
      );

      const radius = holeDiam / 2;
      const csgHeight = cutDepth + CSG_EPSILON;
      const csgGeo = new THREE.CylinderGeometry(radius, radius, csgHeight, 48);
      csgGeo.rotateX(Math.PI / 2);
      csgGeo.translate(cx, cy, (CSG_EPSILON - cutDepth) / 2);

      const brush = new Brush(csgGeo);
      brush.updateMatrixWorld();
      return brush;
    }
  }

  return null;
}

/**
 * Builds the CSG cut meshes for a single operation.
 */
export function buildOperationPreview(
  op: Operation,
  settings: GlobalSettings,
): PreviewMeshes {
  const {
    brush: stockBrush,
    w: stockW,
    h: stockH,
    t: stockT,
  } = createStockBrush(settings);
  const tool = getToolById(op.toolId);
  const toolDiam = tool.diameterMm;

  let visualCutObject: THREE.Object3D | null = null;
  const wireframes: THREE.LineSegments[] = [];
  let warning: string | undefined;

  switch (op.type) {
    case "surfacing": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, stockW));
      const height = Math.max(0.1, evalDim(op.height, stockH));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT, evalDim(op.cutDepth, 1)),
      );

      // Visual cut volume (pure BoxGeometry without CSG, zero triangulation lines)
      const visGeo = new THREE.BoxGeometry(width, height, cutDepth);
      visGeo.translate(x + width / 2, y + height / 2, -cutDepth / 2);
      visualCutObject = new THREE.Mesh(visGeo, cutMaterial);

      // Clean box wireframe
      wireframes.push(
        createBoxWireframe(
          x,
          y,
          x + width,
          y + height,
          0,
          -cutDepth,
          cutEdgeMaterial,
        ),
      );
      break;
    }

    case "profiling": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, 50));
      const height = Math.max(0.1, evalDim(op.height, 50));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT + 1, evalDim(op.cutDepth, 5)),
      );

      let outerMinX: number,
        outerMaxX: number,
        outerMinY: number,
        outerMaxY: number;
      let innerMinX: number,
        innerMaxX: number,
        innerMinY: number,
        innerMaxY: number;

      if (op.side === "outside") {
        outerMinX = x - toolDiam;
        outerMaxX = x + width + toolDiam;
        outerMinY = y - toolDiam;
        outerMaxY = y + height + toolDiam;
        innerMinX = x;
        innerMaxX = x + width;
        innerMinY = y;
        innerMaxY = y + height;
      } else {
        outerMinX = x;
        outerMaxX = x + width;
        outerMinY = y;
        outerMaxY = y + height;
        innerMinX = Math.min(x + width / 2, x + toolDiam);
        innerMaxX = Math.max(x + width / 2, x + width - toolDiam);
        innerMinY = Math.min(y + height / 2, y + toolDiam);
        innerMaxY = Math.max(y + height / 2, y + height - toolDiam);
      }

      const innerW = Math.max(0.01, innerMaxX - innerMinX);
      const outerH = outerMaxY - outerMinY;

      // Visual mesh built from 4 clean BoxGeometries (left, right, bottom, top)
      const frameGroup = new THREE.Group();
      const zCenter = -cutDepth / 2;

      // Left bar
      const leftW = innerMinX - outerMinX;
      if (leftW > 0.01) {
        const leftGeo = new THREE.BoxGeometry(leftW, outerH, cutDepth);
        leftGeo.translate(
          (outerMinX + innerMinX) / 2,
          (outerMinY + outerMaxY) / 2,
          zCenter,
        );
        frameGroup.add(new THREE.Mesh(leftGeo, cutMaterial));
      }

      // Right bar
      const rightW = outerMaxX - innerMaxX;
      if (rightW > 0.01) {
        const rightGeo = new THREE.BoxGeometry(rightW, outerH, cutDepth);
        rightGeo.translate(
          (innerMaxX + outerMaxX) / 2,
          (outerMinY + outerMaxY) / 2,
          zCenter,
        );
        frameGroup.add(new THREE.Mesh(rightGeo, cutMaterial));
      }

      // Bottom bar
      const bottomH = innerMinY - outerMinY;
      if (bottomH > 0.01) {
        const btmGeo = new THREE.BoxGeometry(innerW, bottomH, cutDepth);
        btmGeo.translate(
          (innerMinX + innerMaxX) / 2,
          (outerMinY + innerMinY) / 2,
          zCenter,
        );
        frameGroup.add(new THREE.Mesh(btmGeo, cutMaterial));
      }

      // Top bar
      const topH = outerMaxY - innerMaxY;
      if (topH > 0.01) {
        const topGeo = new THREE.BoxGeometry(innerW, topH, cutDepth);
        topGeo.translate(
          (innerMinX + innerMaxX) / 2,
          (innerMaxY + outerMaxY) / 2,
          zCenter,
        );
        frameGroup.add(new THREE.Mesh(topGeo, cutMaterial));
      }

      visualCutObject = frameGroup;

      // Clean CAD wireframes for outer and inner rectangles
      wireframes.push(
        createBoxWireframe(
          outerMinX,
          outerMinY,
          outerMaxX,
          outerMaxY,
          0,
          -cutDepth,
          cutEdgeMaterial,
        ),
      );
      wireframes.push(
        createBoxWireframe(
          innerMinX,
          innerMinY,
          innerMaxX,
          innerMaxY,
          0,
          -cutDepth,
          cutEdgeMaterial,
        ),
      );
      break;
    }

    case "pocket": {
      const x = evalDim(op.x, 0);
      const y = evalDim(op.y, 0);
      const width = Math.max(0.1, evalDim(op.width, 40));
      const height = Math.max(0.1, evalDim(op.height, 30));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT, evalDim(op.cutDepth, 3)),
      );

      if (width < toolDiam || height < toolDiam) {
        warning = `Pocket size (${width.toFixed(1)}x${height.toFixed(1)}mm) is smaller than tool diameter (${toolDiam.toFixed(2)}mm).`;
      }

      // Visual cut volume
      const visGeo = new THREE.BoxGeometry(width, height, cutDepth);
      visGeo.translate(x + width / 2, y + height / 2, -cutDepth / 2);
      visualCutObject = new THREE.Mesh(visGeo, cutMaterial);

      // Clean CAD box wireframe
      wireframes.push(
        createBoxWireframe(
          x,
          y,
          x + width,
          y + height,
          0,
          -cutDepth,
          cutEdgeMaterial,
        ),
      );
      break;
    }

    case "hole": {
      const cx = evalDim(op.x, stockW / 2);
      const cy = evalDim(op.y, stockH / 2);
      const holeDiam = Math.max(0.1, evalDim(op.diameter, toolDiam));
      const cutDepth = Math.max(
        0.01,
        Math.min(stockT + 2, evalDim(op.cutDepth, 5)),
      );

      if (holeDiam < toolDiam - 0.05) {
        warning = `Hole diameter (${holeDiam.toFixed(2)}mm) is smaller than bit diameter (${toolDiam.toFixed(2)}mm).`;
      }

      const radius = holeDiam / 2;

      // Visual cylinder mesh
      const visGeo = new THREE.CylinderGeometry(radius, radius, cutDepth, 48);
      visGeo.rotateX(Math.PI / 2);
      visGeo.translate(cx, cy, -cutDepth / 2);
      visualCutObject = new THREE.Mesh(visGeo, cutMaterial);

      // Clean cylinder wireframe: top circle rim, bottom circle rim, 4 quadrant lines
      wireframes.push(
        createCylinderWireframe(
          cx,
          cy,
          radius,
          0,
          -cutDepth,
          48,
          cutEdgeMaterial,
        ),
      );
      break;
    }
  }

  // Perform CSG subtraction on stock
  const cutBrush = buildCutterBrush(op, settings);
  let remainingStock: THREE.Mesh;
  if (cutBrush) {
    try {
      remainingStock = evaluator.evaluate(stockBrush, cutBrush, SUBTRACTION);
      remainingStock.material = remainingMaterial;
    } catch {
      remainingStock = stockBrush;
    }
  } else {
    remainingStock = stockBrush;
  }

  // Clean outer stock outline (12 pure box edges, zero diagonal triangulation lines)
  wireframes.push(
    createBoxWireframe(0, 0, stockW, stockH, 0, -stockT, edgeMaterial),
  );

  return {
    remainingStock,
    cutVolume: visualCutObject || undefined,
    wireframes,
    warning,
  };
}

/**
 * Builds accumulated 3D preview for ALL enabled operations in the project.
 */
export function buildAccumulatedPreview(
  operations: Operation[],
  settings: GlobalSettings,
): PreviewMeshes {
  const stockW = Math.max(1, evalDim(settings.stockWidth, 100));
  const stockH = Math.max(1, evalDim(settings.stockHeight, 75));
  const stockT = Math.max(0.5, evalDim(settings.stockThickness, 12.7));

  let currentStockBrush = createStockBrush(settings).brush;
  const cutGroup = new THREE.Group();
  const wireframes: THREE.LineSegments[] = [];
  let warning: string | undefined;

  for (const op of operations) {
    if (!op.enabled) continue;
    const {
      cutVolume,
      wireframes: opWires,
      warning: opWarning,
    } = buildOperationPreview(op, settings);
    if (opWarning && !warning) warning = opWarning;

    // CSG subtraction from stock for every operation type!
    const cutBrush = buildCutterBrush(op, settings);
    if (cutBrush) {
      try {
        const nextBrush = evaluator.evaluate(
          currentStockBrush,
          cutBrush,
          SUBTRACTION,
        );
        nextBrush.material = remainingMaterial;
        currentStockBrush = nextBrush;
      } catch (err) {
        console.warn("CSG subtraction error on op:", op.name, err);
      }
    }

    if (cutVolume) {
      cutGroup.add(cutVolume.clone());
    }

    if (opWires) {
      // Add operation wireframes (excluding stock box wireframe which we add once at the end)
      for (let i = 0; i < opWires.length - 1; i++) {
        wireframes.push(opWires[i]);
      }
    }
  }

  // Add stock box wireframe once
  wireframes.push(
    createBoxWireframe(0, 0, stockW, stockH, 0, -stockT, edgeMaterial),
  );

  return {
    remainingStock: currentStockBrush,
    cutVolume: cutGroup.children.length > 0 ? cutGroup : undefined,
    wireframes,
    warning,
  };
}
