import * as THREE from 'three';

/**
 * Export a BufferGeometry to binary STL format.
 * Returns an ArrayBuffer containing the STL data.
 */
export function geometryToSTLBinary(geometry) {
  // Ensure we have a non-indexed geometry for correct triangle iteration
  let geo = geometry;
  if (geo.index !== null) {
    geo = geo.toNonIndexed();
  }

  const positions = geo.getAttribute('position');
  const numTriangles = positions.count / 3;

  const bufferLength = 80 + 4 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);

  // Header (80 bytes) - write app name
  const header = 'StorageBlox STL Export';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Number of triangles
  view.setUint32(80, numTriangles, true);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  let offset = 84;

  for (let i = 0; i < numTriangles; i++) {
    const idx = i * 3;
    vA.fromBufferAttribute(positions, idx);
    vB.fromBufferAttribute(positions, idx + 1);
    vC.fromBufferAttribute(positions, idx + 2);

    // Compute face normal
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab).normalize();

    // Normal
    view.setFloat32(offset, cb.x, true); offset += 4;
    view.setFloat32(offset, cb.y, true); offset += 4;
    view.setFloat32(offset, cb.z, true); offset += 4;

    // Vertices
    view.setFloat32(offset, vA.x, true); offset += 4;
    view.setFloat32(offset, vA.y, true); offset += 4;
    view.setFloat32(offset, vA.z, true); offset += 4;

    view.setFloat32(offset, vB.x, true); offset += 4;
    view.setFloat32(offset, vB.y, true); offset += 4;
    view.setFloat32(offset, vB.z, true); offset += 4;

    view.setFloat32(offset, vC.x, true); offset += 4;
    view.setFloat32(offset, vC.y, true); offset += 4;
    view.setFloat32(offset, vC.z, true); offset += 4;

    // Attribute byte count
    view.setUint16(offset, 0, true); offset += 2;
  }

  if (geo !== geometry) geo.dispose();

  return buffer;
}
