import type { ClimateManifest, DisplayMode, FrameLoadState, FramePair, HoveredCell, LegendSelection, TemperatureUnit, VectorLayerVisibility } from '../climate/types';

export interface ClimateState {
  manifest: ClimateManifest | null;
  mask: Uint8Array | null;
  framePair: FramePair | null;
  week: number;
  activeRequestId: number;
  loadState: FrameLoadState;
  fatalError: string | null;
  mode: DisplayMode;
  unit: TemperatureUnit;
  playing: boolean;
  hoveredCell: HoveredCell | null;
  legendHover: LegendSelection | null;
  legendLocked: LegendSelection | null;
  vectorLayers: VectorLayerVisibility;
}

export const initialClimateState: ClimateState = {
  manifest: null, mask: null, framePair: null, week: 0, activeRequestId: 0,
  loadState: { status: 'idle' }, fatalError: null, mode: 'composite', unit: 'C', playing: false,
  hoveredCell: null, legendHover: null, legendLocked: null,
  vectorLayers: { countries: true, coastlines: true },
};

export type ClimateAction =
  | { type: 'BOOT_READY'; manifest: ClimateManifest; mask: Uint8Array }
  | { type: 'FATAL_ERROR'; message: string }
  | { type: 'FRAME_REQUEST'; week: number; requestId: number }
  | { type: 'FRAME_SUCCESS'; week: number; requestId: number; pair: FramePair }
  | { type: 'FRAME_ERROR'; requestId: number; message: string }
  | { type: 'SET_MODE'; mode: DisplayMode }
  | { type: 'SET_UNIT'; unit: TemperatureUnit }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_HOVERED_CELL'; cell: HoveredCell | null }
  | { type: 'SET_LEGEND_HOVER'; selection: LegendSelection | null }
  | { type: 'SET_LEGEND_LOCK'; selection: LegendSelection | null }
  | { type: 'TOGGLE_VECTOR_LAYER'; layer: keyof VectorLayerVisibility };

export function climateReducer(state: ClimateState, action: ClimateAction): ClimateState {
  switch (action.type) {
    case 'BOOT_READY': return { ...state, manifest: action.manifest, mask: action.mask };
    case 'FATAL_ERROR': return { ...state, fatalError: action.message, loadState: { status: 'error', message: action.message, recoverable: false } };
    case 'FRAME_REQUEST': return { ...state, activeRequestId: action.requestId, loadState: { status: 'loading', requestedWeek: action.week, retainingFrame: state.framePair !== null } };
    case 'FRAME_SUCCESS':
      if (action.requestId !== state.activeRequestId) return state;
      return { ...state, week: action.week, framePair: action.pair, loadState: { status: 'ready', week: action.week }, hoveredCell: null };
    case 'FRAME_ERROR':
      if (action.requestId !== state.activeRequestId) return state;
      return { ...state, playing: false, loadState: { status: 'error', message: action.message, recoverable: state.framePair !== null } };
    case 'SET_MODE': return { ...state, mode: action.mode, hoveredCell: null };
    case 'SET_UNIT': return { ...state, unit: action.unit };
    case 'SET_PLAYING': return { ...state, playing: action.playing };
    case 'SET_HOVERED_CELL': return { ...state, hoveredCell: action.cell };
    case 'SET_LEGEND_HOVER': return { ...state, legendHover: action.selection };
    case 'SET_LEGEND_LOCK': return { ...state, legendLocked: action.selection, legendHover: null };
    case 'TOGGLE_VECTOR_LAYER': return { ...state, vectorLayers: { ...state.vectorLayers, [action.layer]: !state.vectorLayers[action.layer] } };
  }
}

export function effectiveLegendSelection(state: ClimateState): LegendSelection | null {
  return state.legendLocked ?? state.legendHover;
}

