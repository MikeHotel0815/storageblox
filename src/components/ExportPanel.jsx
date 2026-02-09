import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getBoxTypes } from '../lib/gridCalculator';
import { getBoxDimensions } from '../lib/boxGeometry';
import { exportSingleBox, exportAllAsZip, exportAs3MF } from '../lib/exportManager';
import { PRINTERS } from '../lib/printerProfiles';
import { packingSummary } from '../lib/platePacker';

export default function ExportPanel() {
  const { state } = useApp();
  const { params, grid, boxes } = state;
  const boxTypes = getBoxTypes(boxes);
  const [exporting, setExporting] = useState(false);

  const printer = PRINTERS[params.printer] || PRINTERS['bambu-h2s'];

  const summary = useMemo(() => {
    const items = [];
    for (const bt of boxTypes) {
      const { width, depth } = getBoxDimensions(bt.spanCols, bt.spanRows, params.gridSize, params.tolerance);
      items.push({
        id: `box_${bt.spanCols}x${bt.spanRows}`,
        width, depth,
        count: bt.count,
        label: `Box ${bt.spanCols}x${bt.spanRows}`,
      });
    }
    if (params.generateSpacers) {
      if (grid.deadSpaceX > 0.1) {
        items.push({ id: 'spacer_x', width: grid.deadSpaceX, depth: params.drawerDepth, count: 1, label: 'Spacer X' });
      }
      if (grid.deadSpaceY > 0.1) {
        const sw = params.drawerWidth - (grid.deadSpaceX > 0.1 ? grid.deadSpaceX : 0);
        items.push({ id: 'spacer_y', width: sw, depth: grid.deadSpaceY, count: 1, label: 'Spacer Y' });
      }
    }
    return packingSummary(items, printer.plate[0], printer.plate[1], printer.height, params.boxHeight);
  }, [boxTypes, params, grid, printer]);

  const handle3MFExport = async () => {
    setExporting(true);
    try {
      await exportAs3MF(boxes, grid, params, params.printer);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Export</h3>

      {/* 3MF Export */}
      <button
        onClick={handle3MFExport}
        disabled={exporting || summary.totalParts === 0}
        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        {exporting ? 'Exportiere...' : 'Als 3MF exportieren'}
      </button>
      <div className="text-[10px] text-slate-500 -mt-1">
        {summary.totalParts} Teile auf {summary.plateCount} Platte{summary.plateCount !== 1 ? 'n' : ''}
        &middot; {printer.name}
      </div>

      {/* Oversized warnings */}
      {summary.oversized.length > 0 && (
        <div className="flex flex-col gap-1">
          {summary.oversized.map((item, i) => (
            <div key={i} className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1.5">
              <span className="font-bold">{item.label || item.id}</span>: {item.reason}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-700" />

      {/* STL ZIP Export */}
      <button
        onClick={() => exportAllAsZip(boxes, grid, params)}
        className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium
                   rounded transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Alle als STL-ZIP
      </button>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase">Einzelne Box-Typen:</span>
        {boxTypes.map(bt => {
          const { width, depth } = getBoxDimensions(bt.spanCols, bt.spanRows, params.gridSize, params.tolerance);
          return (
            <button
              key={`${bt.spanCols}x${bt.spanRows}`}
              onClick={() => exportSingleBox(bt.spanCols, bt.spanRows, params)}
              className="w-full py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs
                         rounded transition-colors flex items-center justify-between"
            >
              <span className="font-mono font-bold">
                {bt.spanCols}x{bt.spanRows}
              </span>
              <span className="text-slate-500">
                {width.toFixed(1)}x{depth.toFixed(1)}mm &middot; {bt.count}x
              </span>
            </button>
          );
        })}
      </div>

      {params.generateSpacers && (grid.deadSpaceX > 0.1 || grid.deadSpaceY > 0.1) && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase">Spacer</span>
          {grid.deadSpaceX > 0.1 && (
            <div className="text-xs text-green-400 bg-slate-800 rounded px-2 py-1">
              X-Spacer: {grid.deadSpaceX.toFixed(1)} x {params.drawerDepth} mm
            </div>
          )}
          {grid.deadSpaceY > 0.1 && (
            <div className="text-xs text-green-400 bg-slate-800 rounded px-2 py-1">
              Y-Spacer: {(params.drawerWidth - (grid.deadSpaceX > 0.1 ? grid.deadSpaceX : 0)).toFixed(1)} x {grid.deadSpaceY.toFixed(1)} mm
            </div>
          )}
        </div>
      )}
    </div>
  );
}
