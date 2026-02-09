import { useApp } from '../context/AppContext';
import { getBoxTypes } from '../lib/gridCalculator';
import { getBoxDimensions } from '../lib/boxGeometry';
import { exportSingleBox, exportAllAsZip } from '../lib/exportManager';

export default function ExportPanel() {
  const { state } = useApp();
  const { params, grid, boxes } = state;
  const boxTypes = getBoxTypes(boxes);

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Export</h3>

      <button
        onClick={() => exportAllAsZip(boxes, grid, params)}
        className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium
                   rounded transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Alle als ZIP exportieren
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
          <span className="text-[10px] text-slate-500 uppercase">Spacer (im ZIP enthalten)</span>
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
