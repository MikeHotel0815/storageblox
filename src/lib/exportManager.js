import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createHollowBoxGeometry, createSpacerGeometry, getBoxDimensions } from './boxGeometry';
import { geometryToSTLBinary } from './stlExporter';
import { getBoxTypes } from './gridCalculator';
import { generate3MF } from './threemfExporter';
import { packOnPlates } from './platePacker';
import { PRINTERS } from './printerProfiles';

function generateBoxSTL(spanCols, spanRows, params) {
  const { gridSize, tolerance, boxHeight, wallThickness, cornerRadius, cornerMode } = params;
  const { width, depth } = getBoxDimensions(spanCols, spanRows, gridSize, tolerance);
  const geo = createHollowBoxGeometry(width, depth, boxHeight, wallThickness, cornerRadius, cornerMode);
  const stl = geometryToSTLBinary(geo);
  geo.dispose();
  return stl;
}

function generateSpacerSTL(width, depth, height, cornerRadius) {
  const geo = createSpacerGeometry(width, depth, height, cornerRadius);
  const stl = geometryToSTLBinary(geo);
  geo.dispose();
  return stl;
}

export function exportSingleBox(spanCols, spanRows, params) {
  const stl = generateBoxSTL(spanCols, spanRows, params);
  const blob = new Blob([stl], { type: 'application/octet-stream' });
  saveAs(blob, `box_${spanCols}x${spanRows}.stl`);
}

export async function exportAllAsZip(boxes, grid, params) {
  const zip = new JSZip();
  const boxTypes = getBoxTypes(boxes);

  // Add box STLs
  for (const bt of boxTypes) {
    const stl = generateBoxSTL(bt.spanCols, bt.spanRows, params);
    zip.file(`box_${bt.spanCols}x${bt.spanRows}.stl`, stl);
  }

  // Add spacers if enabled
  if (params.generateSpacers) {
    const { deadSpaceX, deadSpaceY } = grid;
    if (deadSpaceX > 0.1) {
      const stl = generateSpacerSTL(deadSpaceX, params.drawerDepth, params.boxHeight, 0);
      zip.file('spacer_x.stl', stl);
    }
    if (deadSpaceY > 0.1) {
      const spacerWidth = params.drawerWidth - (deadSpaceX > 0.1 ? deadSpaceX : 0);
      const stl = generateSpacerSTL(spacerWidth, deadSpaceY, params.boxHeight, 0);
      zip.file('spacer_y.stl', stl);
    }
  }

  // Add BOM
  let bom = 'StorageBlox - Bill of Materials\n';
  bom += '================================\n\n';
  bom += `Drawer: ${params.drawerWidth} x ${params.drawerDepth} mm\n`;
  bom += `Grid: ${params.gridSize} mm | Height: ${params.boxHeight} mm\n`;
  bom += `Wall: ${params.wallThickness} mm | Tolerance: ${params.tolerance} mm\n`;
  bom += `Corner Radius: ${params.cornerRadius} mm (${params.cornerMode})\n\n`;
  bom += 'Boxes:\n';
  for (const bt of boxTypes) {
    const { width, depth } = getBoxDimensions(bt.spanCols, bt.spanRows, params.gridSize, params.tolerance);
    bom += `  ${bt.spanCols}x${bt.spanRows} (${width.toFixed(1)} x ${depth.toFixed(1)} mm) - ${bt.count} piece(s)\n`;
  }
  if (params.generateSpacers) {
    const { deadSpaceX, deadSpaceY } = grid;
    bom += '\nSpacers:\n';
    if (deadSpaceX > 0.1) bom += `  X-Spacer: ${deadSpaceX.toFixed(1)} x ${params.drawerDepth} mm - 1 piece\n`;
    if (deadSpaceY > 0.1) {
      const sw = params.drawerWidth - (deadSpaceX > 0.1 ? deadSpaceX : 0);
      bom += `  Y-Spacer: ${sw.toFixed(1)} x ${deadSpaceY.toFixed(1)} mm - 1 piece\n`;
    }
  }
  zip.file('BOM.txt', bom);

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'storageblox_export.zip');
}

export async function exportAs3MF(boxes, grid, params, printerKey) {
  const printer = PRINTERS[printerKey] || PRINTERS['bambu-h2s'];
  const [plateW, plateD] = printer.plate;
  const boxTypes = getBoxTypes(boxes);

  // Build packing items: one entry per box type with count
  const packItems = [];
  const geometries = new Map();
  let objectId = 1;

  for (const bt of boxTypes) {
    const { width, depth } = getBoxDimensions(bt.spanCols, bt.spanRows, params.gridSize, params.tolerance);
    const id = `box_${bt.spanCols}x${bt.spanRows}`;
    packItems.push({ id, width, depth, count: bt.count, label: `Box ${bt.spanCols}x${bt.spanRows}` });

    const geo = createHollowBoxGeometry(width, depth, params.boxHeight, params.wallThickness, params.cornerRadius, params.cornerMode);
    geometries.set(id, { geometry: geo, objectId: objectId++, label: `Box ${bt.spanCols}x${bt.spanRows}` });
  }

  // Add spacers
  if (params.generateSpacers) {
    const { deadSpaceX, deadSpaceY } = grid;
    if (deadSpaceX > 0.1) {
      const id = 'spacer_x';
      packItems.push({ id, width: deadSpaceX, depth: params.drawerDepth, count: 1, label: 'Spacer X' });
      const geo = createSpacerGeometry(deadSpaceX, params.drawerDepth, params.boxHeight, 0);
      geometries.set(id, { geometry: geo, objectId: objectId++, label: 'Spacer X' });
    }
    if (deadSpaceY > 0.1) {
      const sw = params.drawerWidth - (deadSpaceX > 0.1 ? deadSpaceX : 0);
      const id = 'spacer_y';
      packItems.push({ id, width: sw, depth: deadSpaceY, count: 1, label: 'Spacer Y' });
      const geo = createSpacerGeometry(sw, deadSpaceY, params.boxHeight, 0);
      geometries.set(id, { geometry: geo, objectId: objectId++, label: 'Spacer Y' });
    }
  }

  // Run packing
  const packResult = packOnPlates(packItems, plateW, plateD, printer.height, params.boxHeight);

  // Build 3MF objects and placements
  const objects = [];
  const placements = [];

  for (const [id, entry] of geometries) {
    objects.push({ id: entry.objectId, label: entry.label, geometry: entry.geometry });
  }

  for (const plate of packResult.plates) {
    for (const item of plate.items) {
      const entry = geometries.get(item.id);
      if (!entry) continue;
      placements.push({
        objectId: entry.objectId,
        x: item.x + item.width / 2,
        y: item.y + item.depth / 2,
        z: 0,
        plateIndex: plate.plateIndex,
      });
    }
  }

  const blob = await generate3MF(objects, placements, {
    projectName: 'StorageBlox Export',
    printerName: printer.name,
  });

  // Cleanup
  for (const entry of geometries.values()) {
    entry.geometry.dispose();
  }

  saveAs(blob, 'storageblox_export.3mf');
  return packResult;
}
