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

const RIB_SPACING = 60; // mm — max distance between internal support ribs

/**
 * Create hollow spacer geometry with internal ribs for stability.
 * Open top, closed bottom. Ribs are added automatically when inner
 * dimensions exceed RIB_SPACING. Z-up orientation.
 */
export function createSpacerGeometry(width, depth, height, wallThickness, cornerRadius = 0) {
  const shell = createHollowBoxGeometry(width, depth, height, wallThickness, cornerRadius, 'outer');

  const innerWidth = width - 2 * wallThickness;
  const innerDepth = depth - 2 * wallThickness;
  const ribHeight = height - wallThickness;

  if (innerWidth <= RIB_SPACING && innerDepth <= RIB_SPACING) {
    return shell;
  }

  const geos = [shell];

  // Ribs perpendicular to X axis (spanning depth)
  if (innerWidth > RIB_SPACING) {
    const ribCount = Math.floor(innerWidth / RIB_SPACING);
    const spacing = innerWidth / (ribCount + 1);
    for (let i = 1; i <= ribCount; i++) {
      const rib = new THREE.BoxGeometry(wallThickness, innerDepth, ribHeight);
      rib.translate(-innerWidth / 2 + i * spacing, 0, wallThickness + ribHeight / 2);
      geos.push(rib);
    }
  }

  // Ribs perpendicular to Y axis (spanning width)
  if (innerDepth > RIB_SPACING) {
    const ribCount = Math.floor(innerDepth / RIB_SPACING);
    const spacing = innerDepth / (ribCount + 1);
    for (let i = 1; i <= ribCount; i++) {
      const rib = new THREE.BoxGeometry(innerWidth, wallThickness, ribHeight);
      rib.translate(0, -innerDepth / 2 + i * spacing, wallThickness + ribHeight / 2);
      geos.push(rib);
    }
  }

  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
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
