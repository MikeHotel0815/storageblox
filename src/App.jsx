import Dashboard from './components/Dashboard';
import GridEditor from './components/GridEditor';
import Scene3D from './components/Scene3D';
import ExportPanel from './components/ExportPanel';

export default function App() {
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Storage<span className="text-cyan-400">Blox</span>
          </h1>
          <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
            Drawer Organizer Generator
          </span>
        </div>
        <span className="text-[10px] text-slate-600">blox.himmelreich.cloud</span>
      </header>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 bg-slate-800/50 border-r border-slate-700 flex flex-col overflow-y-auto">
          <Dashboard />
          <div className="border-t border-slate-700" />
          <GridEditor />
          <div className="border-t border-slate-700 mt-auto" />
          <ExportPanel />
        </aside>

        {/* 3D View */}
        <main className="flex-1 min-w-0 relative">
          <Scene3D />
          <div className="absolute bottom-3 left-3 text-[10px] text-slate-600">
            Linke Maustaste: Drehen | Mausrad: Zoom | Rechte Maustaste: Verschieben
          </div>
        </main>
      </div>
    </div>
  );
}
