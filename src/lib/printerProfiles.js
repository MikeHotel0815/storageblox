export const PRINTERS = {
  // --- Bambu Lab ---
  'bambu-h2s':  { name: 'Bambu Lab H2S',       plate: [340, 320], height: 340, brand: 'Bambu Lab' },
  'bambu-h2d':  { name: 'Bambu Lab H2D',       plate: [350, 320], height: 325, brand: 'Bambu Lab' },
  'bambu-h2c':  { name: 'Bambu Lab H2C',       plate: [325, 320], height: 325, brand: 'Bambu Lab' },
  'bambu-x1c':  { name: 'Bambu Lab X1 Carbon', plate: [256, 256], height: 256, brand: 'Bambu Lab' },
  'bambu-x1e':  { name: 'Bambu Lab X1E',       plate: [256, 256], height: 256, brand: 'Bambu Lab' },
  'bambu-p1s':  { name: 'Bambu Lab P1S',       plate: [256, 256], height: 256, brand: 'Bambu Lab' },
  'bambu-p1p':  { name: 'Bambu Lab P1P',       plate: [256, 256], height: 256, brand: 'Bambu Lab' },
  'bambu-a1':   { name: 'Bambu Lab A1',        plate: [256, 256], height: 256, brand: 'Bambu Lab' },
  'bambu-a1m':  { name: 'Bambu Lab A1 Mini',   plate: [180, 180], height: 180, brand: 'Bambu Lab' },
  // --- Prusa ---
  'prusa-xl':     { name: 'Prusa XL',          plate: [360, 360], height: 360, brand: 'Prusa' },
  'prusa-core1l': { name: 'Prusa CORE One L',  plate: [300, 300], height: 330, brand: 'Prusa' },
  'prusa-core1':  { name: 'Prusa CORE One+',   plate: [250, 220], height: 270, brand: 'Prusa' },
  'prusa-mk4s':   { name: 'Prusa MK4S',        plate: [250, 210], height: 220, brand: 'Prusa' },
  'prusa-mk3s':   { name: 'Prusa MK3S+',       plate: [250, 210], height: 210, brand: 'Prusa' },
  'prusa-mini':   { name: 'Prusa Mini+',       plate: [180, 180], height: 180, brand: 'Prusa' },
  // --- Custom ---
  'custom': { name: 'Benutzerdefiniert', plate: [256, 256], height: 256, brand: 'Custom' },
};

export const DEFAULT_PRINTER = 'bambu-h2s';

export const DEFAULT_PRINT_PROFILE = {
  layerHeight: 0.2,
  wallLoops: 2,
  infillDensity: 15,
  infillPattern: 'grid',
  topLayers: 3,
  bottomLayers: 3,
};

export function getPrinterBrands() {
  const brands = new Map();
  for (const [key, printer] of Object.entries(PRINTERS)) {
    if (!brands.has(printer.brand)) brands.set(printer.brand, []);
    brands.get(printer.brand).push({ key, ...printer });
  }
  return brands;
}
