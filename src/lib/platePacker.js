const SPACING = 5; // mm between parts

/**
 * Pack rectangles onto plates using a shelf-based algorithm.
 *
 * @param {Array} items - [{id, width, depth, count}]
 * @param {number} plateWidth - Build plate width in mm
 * @param {number} plateDepth - Build plate depth in mm
 * @param {number} maxHeight - Max print height in mm
 * @param {number} partHeight - Height of the parts being packed
 * @returns {{ plates: Array, oversized: Array }}
 */
export function packOnPlates(items, plateWidth, plateDepth, maxHeight, partHeight) {
  const oversized = [];
  const toPack = [];

  // Check for oversized parts and height limit
  for (const item of items) {
    const w = item.width;
    const d = item.depth;
    const fitsNormal = w + SPACING <= plateWidth && d + SPACING <= plateDepth;
    const fitsRotated = d + SPACING <= plateWidth && w + SPACING <= plateDepth;
    const itemHeight = item.height || partHeight;
    const fitsTall = itemHeight <= maxHeight;

    if (!fitsTall) {
      oversized.push({
        ...item,
        reason: `Höhe ${itemHeight}mm übersteigt max. Druckhöhe ${maxHeight}mm`,
      });
    } else if (!fitsNormal && !fitsRotated) {
      oversized.push({
        ...item,
        reason: `${w.toFixed(1)} x ${d.toFixed(1)}mm passt nicht auf Bauplatte ${plateWidth} x ${plateDepth}mm`,
      });
    } else {
      // Expand by count, optionally rotate to fit better
      for (let i = 0; i < item.count; i++) {
        const rotated = !fitsNormal && fitsRotated;
        toPack.push({
          id: item.id,
          w: rotated ? d : w,
          d: rotated ? w : d,
          label: item.label || item.id,
        });
      }
    }
  }

  // Sort largest first (by area, descending)
  toPack.sort((a, b) => (b.w * b.d) - (a.w * a.d));

  const plates = [];
  let currentPlate = newPlate(plateWidth, plateDepth);
  plates.push(currentPlate);

  for (const rect of toPack) {
    const placed = placeOnPlate(currentPlate, rect);
    if (!placed) {
      // Start new plate
      currentPlate = newPlate(plateWidth, plateDepth);
      plates.push(currentPlate);
      placeOnPlate(currentPlate, rect);
    }
  }

  return {
    plates: plates.map((p, i) => ({ plateIndex: i, items: p.items })),
    oversized,
  };
}

function newPlate(width, depth) {
  return {
    items: [],
    // Shelf-based: track rows of parts
    shelves: [{ y: 0, height: 0, x: 0, maxWidth: width }],
    width,
    depth,
  };
}

function placeOnPlate(plate, rect) {
  const rw = rect.w + SPACING;
  const rd = rect.d + SPACING;

  // Try to place on existing shelves
  for (const shelf of plate.shelves) {
    if (shelf.x + rw <= plate.width && shelf.y + rd <= plate.depth) {
      plate.items.push({
        id: rect.id,
        label: rect.label,
        x: shelf.x,
        y: shelf.y,
        width: rect.w,
        depth: rect.d,
      });
      shelf.x += rw;
      if (rd > shelf.height) shelf.height = rd;
      return true;
    }
  }

  // Try new shelf
  const lastShelf = plate.shelves[plate.shelves.length - 1];
  const newY = lastShelf.y + lastShelf.height;
  if (newY + rd <= plate.depth && rw <= plate.width) {
    const shelf = { y: newY, height: rd, x: rw, maxWidth: plate.width };
    plate.shelves.push(shelf);
    plate.items.push({
      id: rect.id,
      label: rect.label,
      x: 0,
      y: newY,
      width: rect.w,
      depth: rect.d,
    });
    return true;
  }

  return false;
}

/**
 * Compute packing summary for display in UI (without generating geometry).
 */
export function packingSummary(items, plateWidth, plateDepth, maxHeight, partHeight) {
  const result = packOnPlates(items, plateWidth, plateDepth, maxHeight, partHeight);
  const totalParts = result.plates.reduce((sum, p) => sum + p.items.length, 0);
  return {
    plateCount: result.plates.length,
    totalParts,
    oversized: result.oversized,
  };
}
