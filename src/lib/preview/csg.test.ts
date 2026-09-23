import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { describe, expect, it } from "vitest";

describe("three-bvh-csg", () => {
  it("performs subtraction between box and cylinder", () => {
    const boxGeo = new THREE.BoxGeometry(10, 10, 5);
    const boxBrush = new Brush(boxGeo);
    boxBrush.updateMatrixWorld();

    const cylGeo = new THREE.CylinderGeometry(2, 2, 6, 16);
    const cylBrush = new Brush(cylGeo);
    cylBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    const result = evaluator.evaluate(boxBrush, cylBrush, SUBTRACTION);

    expect(result).toBeDefined();
    expect(result.geometry).toBeDefined();
    expect(result.geometry.attributes.position.count).toBeGreaterThan(0);
  });
});
