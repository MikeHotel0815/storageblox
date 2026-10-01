import JSZip from 'jszip';

const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

/**
 * Convert a Three.js BufferGeometry to 3MF mesh XML (vertices + triangles).
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
  };
}

/**
 * Build a 3x4 row-major affine transform string for 3MF.
 * Format: m00 m01 m02 m10 m11 m12 m20 m21 m22 m03 m13 m23
 */
function buildTransform(x, y, z) {
  return `1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;
}

/**
 * Generate Bambu Studio model_settings.config for multi-plate support.
 */
function generateModelSettings(objects, placements) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>'];

  // Object definitions
  for (const obj of objects) {
    lines.push(`  <object id="${obj.id}">`);
    lines.push(`    <metadata key="name" value="${esc(obj.label)}"/>`);
    lines.push(`    <part id="0" subtype="normal_part">`);
    lines.push(`      <metadata key="name" value="${esc(obj.label)}"/>`);
    lines.push(`      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>`);
    lines.push(`      <metadata key="source_file" value="${esc(obj.label)}.stl"/>`);
    lines.push(`      <metadata key="volume_type" value="ModelPart"/>`);
    lines.push(`    </part>`);
    lines.push(`  </object>`);
  }

  // Build instance list with stable IDs, grouped by plate
  const instanceList = [];
  const instanceCounters = new Map();
  let identifyId = 1;

  for (const p of placements) {
    const instanceId = instanceCounters.get(p.objectId) || 0;
    instanceCounters.set(p.objectId, instanceId + 1);
    instanceList.push({
      objectId: p.objectId,
      instanceId,
      identifyId: identifyId++,
      plateIndex: p.plateIndex,
      x: p.x,
      y: p.y,
      z: p.z,
    });
  }

  // Group by plate
  const plateMap = new Map();
  for (const inst of instanceList) {
    if (!plateMap.has(inst.plateIndex)) {
      plateMap.set(inst.plateIndex, []);
    }
    plateMap.get(inst.plateIndex).push(inst);
  }

  // Sort plates by index
  const sortedPlates = [...plateMap.entries()].sort((a, b) => a[0] - b[0]);

  // Plate definitions
  for (const [plateIdx, instances] of sortedPlates) {
    const platerId = plateIdx + 1;
    lines.push(`  <plate>`);
    lines.push(`    <metadata key="plater_id" value="${platerId}"/>`);
    lines.push(`    <metadata key="plater_name" value=""/>`);
    lines.push(`    <metadata key="locked" value="false"/>`);
    lines.push(`    <metadata key="bed_type" value="Textured PEI Plate"/>`);
    lines.push(`    <metadata key="print_sequence" value="by layer"/>`);
    lines.push(`    <metadata key="spiral_mode" value="0"/>`);
    for (const inst of instances) {
      lines.push(`    <model_instance>`);
      lines.push(`      <metadata key="object_id" value="${inst.objectId}"/>`);
      lines.push(`      <metadata key="instance_id" value="${inst.instanceId}"/>`);
      lines.push(`      <metadata key="identify_id" value="${inst.identifyId}"/>`);
      lines.push(`    </model_instance>`);
    }
    lines.push(`  </plate>`);
  }

  // Assembly
  lines.push(`  <assemble>`);
  for (const inst of instanceList) {
    lines.push(`    <assemble_item object_id="${inst.objectId}" instance_id="${inst.instanceId}" transform="${buildTransform(inst.x, inst.y, inst.z)}" offset="0 0 0"/>`);
  }
  lines.push(`  </assemble>`);

  lines.push('</config>');
  return lines.join('\n');
}

/**
 * Generate a 3MF file as a Blob with Bambu Studio multi-plate support.
 *
 * @param {Array} objects - [{ id, label, geometry (THREE.BufferGeometry) }]
 * @param {Array} placements - [{ objectId, x, y, z, plateIndex }]
 * @param {object} metadata - { printerName, projectName }
 * @returns {Promise<Blob>}
 */
export async function generate3MF(objects, placements, metadata = {}) {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml',
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
  <Default Extension="config" ContentType="text/xml" />
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels',
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`);

  // Build mesh XML for each unique object
  const objectXMLParts = [];
  for (const obj of objects) {
    const mesh = geometryToMeshXML(obj.geometry);
    objectXMLParts.push(
`    <object id="${obj.id}" type="model" name="${esc(obj.label)}">
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

  // Build items — one per placement (instance), all in one <build> block
  const itemXMLParts = [];
  for (const p of placements) {
    itemXMLParts.push(
      `    <item objectid="${p.objectId}" transform="${buildTransform(p.x, p.y, p.z)}" printable="1" />`
    );
  }

  // 3D/3dmodel.model
  const metaParts = [];
  if (metadata.projectName) {
    metaParts.push(`  <metadata name="Title">${esc(metadata.projectName)}</metadata>`);
  }
  metaParts.push(`  <metadata name="Application">StorageBlox</metadata>`);
  metaParts.push(`  <metadata name="BambuStudio:3mfVersion">1</metadata>`);

  const modelXML =
`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="${NS}" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xml:lang="de-DE">
${metaParts.join('\n')}
  <resources>
${objectXMLParts.join('\n')}
  </resources>
  <build>
${itemXMLParts.join('\n')}
  </build>
</model>`;

  zip.file('3D/3dmodel.model', modelXML);

  // Metadata/model_settings.config (plate assignments + object configs)
  zip.file('Metadata/model_settings.config', generateModelSettings(objects, placements));

  // Metadata/project_settings.config (basic project settings for Bambu Studio)
  zip.file('Metadata/project_settings.config', generateProjectSettings(metadata));

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  });
}

function generateProjectSettings(metadata) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>'];
  lines.push(`  <header>`);
  lines.push(`    <header_item key="X-BBL-Client-Type" value="slicer"/>`);
  lines.push(`    <header_item key="X-BBL-Client-Version" value="01.10.01.50"/>`);
  lines.push(`  </header>`);
  if (metadata.printerName) {
    lines.push(`  <metadata key="printer_name" value="${esc(metadata.printerName)}"/>`);
  }
  lines.push('</config>');
  return lines.join('\n');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
