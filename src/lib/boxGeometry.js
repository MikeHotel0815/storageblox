import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function roundedRectShape(width, depth, radius, offsetX = 0, offsetY = 0) {
  const shape = new THREE.Shape();
  const r = Math.min(Math.max(radius, 0), width / 2, depth / 2);
  const x = offsetX;
  const y = offsetY;

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  if (r > 0) shape.quadraticCurveTo(x + width, y, x + width, y + r);
  else shape.lineTo(x + width, y);
  shape.lineTo(x + width, y + depth - r);
  if (r > 0) shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  else shape.lineTo(x + width, y + depth);
  shape.lineTo(x + r, y + depth);
  if (r > 0) shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
  else shape.lineTo(x, y + depth);
  shape.lineTo(x, y + r);
  if (r > 0) shape.quadraticCurveTo(x, y, x + r, y);
  else shape.lineTo(x, y);

  return shape;
}

function roundedRectPath(width, depth, radius, offsetX = 0, offsetY = 0) {
  const path = new THREE.Path();
  const r = Math.min(Math.max(radius, 0), width / 2, depth / 2);
  const x = offsetX;
  const y = offsetY;

  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  if (r > 0) path.quadraticCurveTo(x + width, y, x + width, y + r);
  else path.lineTo(x + width, y);
  path.lineTo(x + width, y + depth - r);
  if (r > 0) path.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  else path.lineTo(x + width, y + depth);
  path.lineTo(x + r, y + depth);
  if (r > 0) path.quadraticCurveTo(x, y + depth, x, y + depth - r);
  else path.lineTo(x, y + depth);
  path.lineTo(x, y + r);
  if (r > 0) path.quadraticCurveTo(x, y, x + r, y);
  else path.lineTo(x, y);

  return path;
}

/**
 * Create hollow box geometry (open top, closed bottom).
 * Geometry is in Z-up orientation (XY base, Z = height).
 * Centered at origin on XY, Z from 0 to height.
 */
export function createHollowBoxGeometry(
  width, depth, height, wallThickness,
  cornerRadius = 0, cornerMode = 'outer', curveSegments = 8
) {
  const outerRadius = cornerMode !== 'none' ? cornerRadius : 0;
  const innerRadius = cornerMode === 'both'
    ? Math.max(0, cornerRadius - wallThickness)
    : 0;

  const innerWidth = width - 2 * wallThickness;
  const innerDepth = depth - 2 * wallThickness;

  // Wall profile: outer rounded rect with inner hole
  const wallShape = roundedRectShape(width, depth, outerRadius, -width / 2, -depth / 2);
  const innerHole = roundedRectPath(
    innerWidth, innerDepth, innerRadius,
    -innerWidth / 2, -innerDepth / 2
  );
  wallShape.holes.push(innerHole);

  const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: height - wallThickness,
    bevelEnabled: false,
    curveSegments,
  });
  wallGeo.translate(0, 0, wallThickness);

  // Bottom plate: full rounded rect
  const bottomShape = roundedRectShape(width, depth, outerRadius, -width / 2, -depth / 2);
  const bottomGeo = new THREE.ExtrudeGeometry(bottomShape, {
    depth: wallThickness,
    bevelEnabled: false,
    curveSegments,
  });

  const merged = mergeGeometries([wallGeo, bottomGeo]);
  wallGeo.dispose();
  bottomGeo.dispose();

  return merged;
}

/**
 * Create solid spacer geometry (simple block with optional rounded outer corners).
 * Z-up orientation.
 */
export function createSpacerGeometry(width, depth, height, cornerRadius = 0) {
  const r = Math.min(Math.max(cornerRadius, 0), width / 2, depth / 2);
  const shape = roundedRectShape(width, depth, r, -width / 2, -depth / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 6,
  });
  return geo;
}

/**
 * Get the dimensions a box would have after accounting for tolerance.
 */
export function getBoxDimensions(spanCols, spanRows, gridSize, tolerance) {
  return {
    width: gridSize * spanCols - tolerance,
    depth: gridSize * spanRows - tolerance,
  };
}
