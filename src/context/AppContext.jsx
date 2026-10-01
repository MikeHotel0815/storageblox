import { createContext, useContext, useReducer } from 'react';
import { calculateGrid, initializeBoxes, canMerge } from '../lib/gridCalculator';
import { DEFAULT_PRINTER } from '../lib/printerProfiles';

const AppContext = createContext();

const defaultParams = {
  drawerWidth: 295,
  drawerDepth: 525,
  gridSize: 24.5,
  boxHeight: 50.0,
  wallThickness: 1.0,
  tolerance: 0.5,
  cornerRadius: 1.0,
  cornerMode: 'outer',
  generateSpacers: false,
  printer: DEFAULT_PRINTER,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PARAM': {
      const newParams = { ...state.params, [action.key]: action.value };
      const grid = calculateGrid(newParams.drawerWidth, newParams.drawerDepth, newParams.gridSize);
      if (grid.cols !== state.grid.cols || grid.rows !== state.grid.rows) {
        return {
          ...state,
          params: newParams,
          grid,
          boxes: initializeBoxes(grid.cols, grid.rows),
          selection: null,
          hoveredBox: null,
        };
      }
      return { ...state, params: newParams, grid };
    }
    case 'MERGE_SELECTION': {
      const { startCol, startRow, endCol, endRow } = state.selection;
      const sc = Math.min(startCol, endCol);
      const sr = Math.min(startRow, endRow);
      const ec = Math.max(startCol, endCol);
      const er = Math.max(startRow, endRow);

      if (sc === ec && sr === er) return { ...state, selection: null };
      if (!canMerge(state.boxes, sc, sr, ec, er)) return { ...state, selection: null };

      const spanCols = ec - sc + 1;
      const spanRows = er - sr + 1;
      const remaining = state.boxes.filter(box => {
        const bec = box.col + box.spanCols - 1;
        const ber = box.row + box.spanRows - 1;
        return !(box.col >= sc && bec <= ec && box.row >= sr && ber <= er);
      });
      remaining.push({
        id: `box-${sr}-${sc}-${spanCols}x${spanRows}-${Date.now()}`,
        col: sc, row: sr, spanCols, spanRows,
      });
      return { ...state, boxes: remaining, selection: null };
    }
    case 'SPLIT_BOX': {
      const box = state.boxes.find(b => b.id === action.boxId);
      if (!box || (box.spanCols === 1 && box.spanRows === 1)) return state;
      const remaining = state.boxes.filter(b => b.id !== action.boxId);
      for (let r = box.row; r < box.row + box.spanRows; r++) {
        for (let c = box.col; c < box.col + box.spanCols; c++) {
          remaining.push({ id: `box-${r}-${c}`, col: c, row: r, spanCols: 1, spanRows: 1 });
        }
      }
      return { ...state, boxes: remaining, selection: null };
    }
    case 'SET_SELECTION':
      return { ...state, selection: action.payload };
    case 'SET_HOVERED_BOX':
      return { ...state, hoveredBox: action.boxId };
    case 'RESET_GRID': {
      const grid = calculateGrid(state.params.drawerWidth, state.params.drawerDepth, state.params.gridSize);
      return {
        ...state,
        grid,
        boxes: initializeBoxes(grid.cols, grid.rows),
        selection: null,
        hoveredBox: null,
      };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const grid = calculateGrid(defaultParams.drawerWidth, defaultParams.drawerDepth, defaultParams.gridSize);
  const [state, dispatch] = useReducer(reducer, {
    params: defaultParams,
    grid,
    boxes: initializeBoxes(grid.cols, grid.rows),
    selection: null,
    hoveredBox: null,
  });

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
