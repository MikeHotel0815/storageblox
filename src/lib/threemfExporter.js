import JSZip from 'jszip';
import * as THREE from 'three';

const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

/**
 * Convert a Three.js BufferGeometry to 3MF mesh XML (vertices + triangles).
 * Returns { verticesXML, trianglesXML, vertexCount, triangleCount }.
 */
function geometryToMeshXML(geometry) {
  let geo = geometry;
  if (geo.index !== null) {
    geo = geo.toNonIndexed();
  }

  const pos = geo.getAttribute('position');
  const vertexCount = pos.count;
  const seen = new Map();
  const uniqueVerts = [];
  const indexMap = new Array(vertexCount);

  // Deduplicate vertices
  for (let i = 0; i < vertexCount; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (seen.has(key)) {
      indexMap[i] = seen.get(key);
    } else {
      const idx = uniqueVerts.length;
      seen.set(key, idx);
      uniqueVerts.push([x, y, z]);
      indexMap[i] = idx;
    }
  }

  const vLines = uniqueVerts.map(
    ([x, y, z]) => `          <vertex x="${x}" y="${y}" z="${z}" />`
  );

  const triCount = vertexCount / 3;
  const tLines = [];
  for (let i = 0; i < triCount; i++) {
    const v1 = indexMap[i * 3];
    const v2 = indexMap[i * 3 + 1];
    const v3 = indexMap[i * 3 + 2];
    tLines.push(`          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`);
  }

  if (geo !== geometry) geo.dispose();

  return {
    verticesXML: vLines.join('\n'),
    trianglesXML: tLines.join('\n'),
    vertexCount: uniqueVerts.length,
    triangleCount: triCount,
  };
}

/**
 * Build a 4x3 transform string for 3MF <item> placement.
 * 3MF transform is a 3x4 row-major affine matrix (m00 m01 m02 m03 m10 m11 m12 m13 m20 m21 m22 m23).
 */
function buildTransform(x, y, z) {
  return `1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;
}

/**
 * Generate a 3MF file as a Blob.
 *
 * @param {Array} objects - [{ id, label, geometry (THREE.BufferGeometry) }]
 * @param {Array} placements - [{ objectId, x, y, z, plateIndex }]
 * @param {object} metadata - { printerName, projectName }
 * @returns {Promise<Blob>}
 */
export async function generate3MF(objects, placements, metadata = {}) {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`);

  // Build mesh XML for each object
  const objectXMLParts = [];
  for (const obj of objects) {
    const mesh = geometryToMeshXML(obj.geometry);
    objectXMLParts.push(`    <object id="${obj.id}" type="model" name="${escapeXML(obj.label)}">
      <mesh>
        <vertices>
${mesh.verticesXML}
        </vertices>
        <triangles>
${mesh.trianglesXML}
        </triangles>
      </mesh>
    </object>`);
  }

  // Build items (placements)
  const itemXMLParts = placements.map(p =>
    `    <item objectid="${p.objectId}" transform="${buildTransform(p.x, p.y, p.z)}" />`
  );

  // Metadata
  const metaParts = [];
  if (metadata.projectName) {
    metaParts.push(`  <metadata name="Title">${escapeXML(metadata.projectName)}</metadata>`);
  }
  metaParts.push(`  <metadata name="Application">StorageBlox</metadata>`);
  if (metadata.printerName) {
    metaParts.push(`  <metadata name="Printer">${escapeXML(metadata.printerName)}</metadata>`);
  }

  // 3D/3dmodel.model
  const modelXML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="${NS}" xml:lang="de-DE">
${metaParts.join('\n')}
  <resources>
${objectXMLParts.join('\n')}
  </resources>
  <build>
${itemXMLParts.join('\n')}
  </build>
</model>`;

  zip.file('3D/3dmodel.model', modelXML);

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
}

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
