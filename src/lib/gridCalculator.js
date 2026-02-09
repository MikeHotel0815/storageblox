export function calculateGrid(drawerWidth, drawerDepth, gridSize) {
  const cols = Math.floor(drawerWidth / gridSize);
  const rows = Math.floor(drawerDepth / gridSize);
  const usedWidth = cols * gridSize;
  const usedDepth = rows * gridSize;
  const deadSpaceX = +(drawerWidth - usedWidth).toFixed(2);
  const deadSpaceY = +(drawerDepth - usedDepth).toFixed(2);

  return { cols, rows, usedWidth, usedDepth, deadSpaceX, deadSpaceY };
}

export function initializeBoxes(cols, rows) {
  const boxes = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      boxes.push({
        id: `box-${row}-${col}`,
        col,
        row,
        spanCols: 1,
        spanRows: 1,
      });
    }
  }
  return boxes;
}

export function canMerge(boxes, startCol, startRow, endCol, endRow) {
  const occupied = new Set();
  for (const box of boxes) {
    const boxEndCol = box.col + box.spanCols - 1;
    const boxEndRow = box.row + box.spanRows - 1;
    const fullyInside =
      box.col >= startCol && boxEndCol <= endCol &&
      box.row >= startRow && boxEndRow <= endRow;
    const overlaps = !(
      boxEndCol < startCol || box.col > endCol ||
      boxEndRow < startRow || box.row > endRow
    );
    if (overlaps && !fullyInside) return false;
    if (fullyInside) {
      for (let r = box.row; r <= boxEndRow; r++) {
        for (let c = box.col; c <= boxEndCol; c++) {
          occupied.add(`${r}-${c}`);
        }
      }
    }
  }
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (!occupied.has(`${r}-${c}`)) return false;
    }
  }
  return true;
}

export function getBoxTypes(boxes) {
  const typeMap = new Map();
  for (const box of boxes) {
    const key = `${box.spanCols}x${box.spanRows}`;
    if (!typeMap.has(key)) {
      typeMap.set(key, { spanCols: box.spanCols, spanRows: box.spanRows, count: 0 });
    }
    typeMap.get(key).count++;
  }
  return Array.from(typeMap.values());
}
