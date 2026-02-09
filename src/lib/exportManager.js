import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createHollowBoxGeometry, createSpacerGeometry, getBoxDimensions } from './boxGeometry';
import { geometryToSTLBinary } from './stlExporter';
import { getBoxTypes } from './gridCalculator';

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
