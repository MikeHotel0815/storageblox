import { useApp } from '../context/AppContext';
import { PRINTERS, getPrinterBrands } from '../lib/printerProfiles';

function ParamInput({ label, unit, paramKey, min = 0, max, step = 1 }) {
  const { state, dispatch } = useApp();
  const value = state.params[paramKey];

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-24 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= min && (max === undefined || v <= max)) dispatch({ type: 'SET_PARAM', key: paramKey, value: v });
          }}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white
                     focus:border-cyan-500 focus:outline-none transition-colors"
        />
        <span className="text-xs text-slate-500 w-6">{unit}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { grid, params } = state;

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Drucker</h3>
        <div className="flex flex-col gap-2">
          <select
            value={params.printer}
            onChange={e => dispatch({ type: 'SET_PARAM', key: 'printer', value: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white
                       focus:border-cyan-500 focus:outline-none"
          >
            {Array.from(getPrinterBrands()).map(([brand, printers]) => (
              <optgroup key={brand} label={brand}>
                {printers.map(p => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({p.plate[0]}x{p.plate[1]}mm)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {params.printer !== 'custom' && PRINTERS[params.printer] && (
            <div className="text-[10px] text-slate-500">
              Bauplatte: {PRINTERS[params.printer].plate[0]} x {PRINTERS[params.printer].plate[1]} mm
              &middot; Höhe: {PRINTERS[params.printer].height} mm
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-700" />

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Schublade</h3>
        <div className="flex flex-col gap-2">
          <ParamInput label="Breite" unit="mm" paramKey="drawerWidth" min={10} step={1} />
          <ParamInput label="Tiefe" unit="mm" paramKey="drawerDepth" min={10} step={1} />
        </div>
      </div>

      <div className="border-t border-slate-700" />

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Raster</h3>
        <div className="flex flex-col gap-2">
          <ParamInput label="Rastermaß" unit="mm" paramKey="gridSize" min={5} step={0.5} />
          <ParamInput label="Box-Höhe" unit="mm" paramKey="boxHeight" min={10} max={99} step={1} />
          <ParamInput label="Wandstärke" unit="mm" paramKey="wallThickness" min={0.4} step={0.1} />
          <ParamInput label="Toleranz" unit="mm" paramKey="tolerance" min={0} step={0.05} />
        </div>
      </div>

      <div className="border-t border-slate-700" />

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ecken</h3>
        <div className="flex flex-col gap-2">
          <ParamInput label="Radius" unit="mm" paramKey="cornerRadius" min={0} step={0.5} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-24 shrink-0">Modus</label>
            <select
              value={params.cornerMode}
              onChange={e => dispatch({ type: 'SET_PARAM', key: 'cornerMode', value: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white
                         focus:border-cyan-500 focus:outline-none"
            >
              <option value="outer">Nur außen</option>
              <option value="both">Innen & außen</option>
              <option value="none">Keine</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Info</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-400">Spalten:</span>
          <span className="text-white font-mono">{grid.cols}</span>
          <span className="text-slate-400">Reihen:</span>
          <span className="text-white font-mono">{grid.rows}</span>
          <span className="text-slate-400">Boxen:</span>
          <span className="text-white font-mono">{state.boxes.length}</span>
          <span className="text-slate-400">Rest Breite:</span>
          <span className={`font-mono ${grid.deadSpaceX > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {grid.deadSpaceX} mm
          </span>
          <span className="text-slate-400">Rest Tiefe:</span>
          <span className={`font-mono ${grid.deadSpaceY > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {grid.deadSpaceY} mm
          </span>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={params.generateSpacers}
          onChange={e => dispatch({ type: 'SET_PARAM', key: 'generateSpacers', value: e.target.checked })}
          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-sm text-slate-300">Spacer generieren</span>
      </label>

      <button
        onClick={() => dispatch({ type: 'RESET_GRID' })}
        className="w-full py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300
                   rounded transition-colors"
      >
        Raster zurücksetzen
      </button>
    </div>
  );
}
