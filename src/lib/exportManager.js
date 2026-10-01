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

function generateSpacerSTL(width, depth, height, wallThickness, cornerRadius) {
  const geo = createSpacerGeometry(width, depth, height, wallThickness, cornerRadius);
  const stl = geometryToSTLBinary(geo);
  geo.dispose();
  return stl;
}

/**
 * Split a spacer into pieces that fit the build plate.
 * Repeatedly halves the largest non-fitting dimension.
 * Returns array of { width, depth, count }.
 */
export function splitForPlate(width, depth, plateW, plateD) {
  const fits = (w, d) =>
    (w <= plateW && d <= plateD) || (d <= plateW && w <= plateD);

  if (fits(width, depth)) {
    return [{ width, depth, count: 1 }];
  }

  const pieces = [];

  function split(w, d, count) {
    if (fits(w, d)) {
      const existing = pieces.find(p =>
        Math.abs(p.width - w) < 0.01 && Math.abs(p.depth - d) < 0.01);
      if (existing) {
        existing.count += count;
      } else {
        pieces.push({ width: w, depth: d, count });
      }
      return;
    }
    // Split along the larger dimension
    if (d >= w) {
      split(w, d / 2, count * 2);
    } else {
      split(w / 2, d, count * 2);
    }
  }

  split(width, depth, 1);
  return pieces;
}

/**
 * Get all spacer parts for a given config, auto-split for the build plate.
 * Returns array of { id, width, depth, height, count, label }.
 */
export function getSpacerParts(grid, params, plateW, plateD) {
  const parts = [];
  const spacerHeight = params.boxHeight / 2;
  const { deadSpaceX, deadSpaceY } = grid;

  if (deadSpaceX > 0.1) {
    const pieces = splitForPlate(deadSpaceX, params.drawerDepth, plateW, plateD);
    pieces.forEach((p, i) => {
      const suffix = pieces.length > 1 ? `_${i + 1}` : '';
      parts.push({
        id: `spacer_x${suffix}`,
        width: p.width,
        depth: p.depth,
        height: spacerHeight,
        count: p.count,
        label: `Spacer X${pieces.length > 1 ? ` (${p.width.toFixed(0)}x${p.depth.toFixed(0)})` : ''}`,
      });
    });
  }

  if (deadSpaceY > 0.1) {
    const sw = params.drawerWidth - (deadSpaceX > 0.1 ? deadSpaceX : 0);
    const pieces = splitForPlate(sw, deadSpaceY, plateW, plateD);
    pieces.forEach((p, i) => {
      const suffix = pieces.length > 1 ? `_${i + 1}` : '';
      parts.push({
        id: `spacer_y${suffix}`,
        width: p.width,
        depth: p.depth,
        height: spacerHeight,
        count: p.count,
        label: `Spacer Y${pieces.length > 1 ? ` (${p.width.toFixed(0)}x${p.depth.toFixed(0)})` : ''}`,
      });
    });
  }

  return parts;
}

export function exportSingleBox(spanCols, spanRows, params) {
  const stl = generateBoxSTL(spanCols, spanRows, params);
  const blob = new Blob([stl], { type: 'application/octet-stream' });
  saveAs(blob, `box_${spanCols}x${spanRows}.stl`);
}

export async function exportAllAsZip(boxes, grid, params) {
  const zip = new JSZip();
  const boxTypes = getBoxTypes(boxes);
  const printer = PRINTERS[params.printer] || PRINTERS['bambu-h2s'];
  const [plateW, plateD] = printer.plate;

  // Add box STLs
  for (const bt of boxTypes) {
    const stl = generateBoxSTL(bt.spanCols, bt.spanRows, params);
    zip.file(`box_${bt.spanCols}x${bt.spanRows}.stl`, stl);
  }

  // Add spacers if enabled (hollow, half box height, auto-split for plate)
  const spacerParts = params.generateSpacers ? getSpacerParts(grid, params, plateW, plateD) : [];
  for (const sp of spacerParts) {
    const stl = generateSpacerSTL(sp.width, sp.depth, sp.height, params.wallThickness, 0);
    zip.file(`${sp.id}.stl`, stl);
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
  if (spacerParts.length > 0) {
    const sh = (params.boxHeight / 2).toFixed(1);
    bom += `\nSpacers (hollow, half height = ${sh} mm):\n`;
    for (const sp of spacerParts) {
      bom += `  ${sp.label}: ${sp.width.toFixed(1)} x ${sp.depth.toFixed(1)} x ${sh} mm - ${sp.count} piece(s)\n`;
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

  // Add spacers (auto-split for plate)
  if (params.generateSpacers) {
    const spacerParts = getSpacerParts(grid, params, plateW, plateD);
    for (const sp of spacerParts) {
      packItems.push({ id: sp.id, width: sp.width, depth: sp.depth, count: sp.count, label: sp.label, height: sp.height });
      const geo = createSpacerGeometry(sp.width, sp.depth, sp.height, params.wallThickness, 0);
      geometries.set(sp.id, { geometry: geo, objectId: objectId++, label: sp.label });
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
