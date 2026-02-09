import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';

const BOX_COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

function getBoxColor(box) {
  if (box.spanCols === 1 && box.spanRows === 1) return '#334155';
  const hash = (box.spanCols * 7 + box.spanRows * 13) % BOX_COLORS.length;
  return BOX_COLORS[hash];
}

export default function GridEditor() {
  const { state, dispatch } = useApp();
  const { grid, boxes, selection, params } = state;
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const cellSize = grid.cols > 0 && grid.rows > 0
    ? Math.min(
        280 / grid.cols,
        200 / grid.rows,
        50
      )
    : 40;

  const gridW = grid.cols * cellSize;
  const gridH = grid.rows * cellSize;
  const deadXW = (grid.deadSpaceX / params.gridSize) * cellSize;
  const deadYH = (grid.deadSpaceY / params.gridSize) * cellSize;

  const getCellFromEvent = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return null;
    return { col, row };
  }, [cellSize, grid.cols, grid.rows]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell) return;
    setIsDragging(true);
    setDragStart(cell);
    dispatch({ type: 'SET_SELECTION', payload: { startCol: cell.col, startRow: cell.row, endCol: cell.col, endRow: cell.row } });
  }, [getCellFromEvent, dispatch]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    dispatch({
      type: 'SET_SELECTION',
      payload: { startCol: dragStart.col, startRow: dragStart.row, endCol: cell.col, endRow: cell.row },
    });
  }, [isDragging, dragStart, getCellFromEvent, dispatch]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleBoxClick = useCallback((e, box) => {
    e.stopPropagation();
    if (box.spanCols > 1 || box.spanRows > 1) {
      dispatch({ type: 'SPLIT_BOX', boxId: box.id });
    }
  }, [dispatch]);

  const selectionRect = selection ? {
    col: Math.min(selection.startCol, selection.endCol),
    row: Math.min(selection.startRow, selection.endRow),
    spanCols: Math.abs(selection.endCol - selection.startCol) + 1,
    spanRows: Math.abs(selection.endRow - selection.startRow) + 1,
  } : null;

  const canMergeSelection = selectionRect && (selectionRect.spanCols > 1 || selectionRect.spanRows > 1);

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Layout</h3>
        <div className="flex gap-1">
          {canMergeSelection && (
            <button
              onClick={() => dispatch({ type: 'MERGE_SELECTION' })}
              className="px-2 py-0.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
            >
              Merge {selectionRect.spanCols}x{selectionRect.spanRows}
            </button>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 mb-1">
        Ziehen um Bereich auszuwählen, dann Merge klicken. Auf merged Box klicken zum Splitten.
      </div>

      <div className="flex justify-center">
        <div className="relative" style={{ width: gridW + deadXW, height: gridH + deadYH }}>
          {/* Dead space X */}
          {grid.deadSpaceX > 0 && (
            <div
              className="absolute bg-slate-800/50 border border-dashed border-slate-600"
              style={{
                left: gridW,
                top: 0,
                width: deadXW,
                height: gridH,
              }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-500 rotate-90">
                {grid.deadSpaceX}mm
              </span>
            </div>
          )}

          {/* Dead space Y */}
          {grid.deadSpaceY > 0 && (
            <div
              className="absolute bg-slate-800/50 border border-dashed border-slate-600"
              style={{
                left: 0,
                top: gridH,
                width: gridW,
                height: deadYH,
              }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-500">
                {grid.deadSpaceY}mm
              </span>
            </div>
          )}

          {/* Interactive grid area */}
          <div
            ref={containerRef}
            className="absolute cursor-crosshair"
            style={{ width: gridW, height: gridH }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid lines */}
            {Array.from({ length: grid.cols + 1 }).map((_, i) => (
              <div
                key={`v${i}`}
                className="absolute top-0 w-px bg-slate-700"
                style={{ left: i * cellSize, height: gridH }}
              />
            ))}
            {Array.from({ length: grid.rows + 1 }).map((_, i) => (
              <div
                key={`h${i}`}
                className="absolute left-0 h-px bg-slate-700"
                style={{ top: i * cellSize, width: gridW }}
              />
            ))}

            {/* Boxes */}
            {boxes.map(box => (
              <div
                key={box.id}
                className={`absolute border-2 rounded-sm flex items-center justify-center transition-colors
                  ${box.spanCols > 1 || box.spanRows > 1
                    ? 'cursor-pointer hover:brightness-125 border-white/20'
                    : 'border-transparent'
                  }`}
                style={{
                  left: box.col * cellSize + 1,
                  top: box.row * cellSize + 1,
                  width: box.spanCols * cellSize - 2,
                  height: box.spanRows * cellSize - 2,
                  backgroundColor: getBoxColor(box) + '80',
                }}
                onClick={(e) => handleBoxClick(e, box)}
                onMouseEnter={() => dispatch({ type: 'SET_HOVERED_BOX', boxId: box.id })}
                onMouseLeave={() => dispatch({ type: 'SET_HOVERED_BOX', boxId: null })}
              >
                {(box.spanCols > 1 || box.spanRows > 1) && (
                  <span className="text-[10px] font-bold text-white/80">
                    {box.spanCols}x{box.spanRows}
                  </span>
                )}
              </div>
            ))}

            {/* Selection overlay */}
            {selectionRect && (
              <div
                className="absolute border-2 border-cyan-400 bg-cyan-400/20 rounded-sm pointer-events-none z-10"
                style={{
                  left: selectionRect.col * cellSize,
                  top: selectionRect.row * cellSize,
                  width: selectionRect.spanCols * cellSize,
                  height: selectionRect.spanRows * cellSize,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
