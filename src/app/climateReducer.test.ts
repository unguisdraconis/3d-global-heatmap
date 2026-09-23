import { describe, expect, it } from 'vitest';
import { climateReducer, effectiveLegendSelection, initialClimateState } from './climateReducer';
import type { FramePair, LegendSelection } from '../climate/types';

const pair = { current: { id: 'a', air: new Uint16Array(), sst: new Uint16Array() }, next: { id: 'b', air: new Uint16Array(), sst: new Uint16Array() } } as FramePair;
describe('climate state transitions', () => {
  it('defaults to the native heatmap style and switches without changing climate frames', () => {
    expect(initialClimateState.renderStyle).toBe('heatmap');
    const state = { ...initialClimateState, framePair: pair };
    const smooth = climateReducer(state, { type: 'SET_RENDER_STYLE', renderStyle: 'smooth' });
    expect(smooth.renderStyle).toBe('smooth'); expect(smooth.framePair).toBe(pair);
  });
  it('retains the active frame until a requested pair is atomically ready', () => {
    const old = { ...initialClimateState, framePair: pair, week: 3 };
    const loading = climateReducer(old, { type: 'FRAME_REQUEST', week: 4, requestId: 9 });
    expect(loading.week).toBe(3); expect(loading.framePair).toBe(pair); expect(loading.loadState).toMatchObject({ status: 'loading', retainingFrame: true });
    const ready = climateReducer(loading, { type: 'FRAME_SUCCESS', week: 4, requestId: 9, pair });
    expect(ready.week).toBe(4); expect(ready.loadState).toEqual({ status: 'ready', week: 4 });
  });
  it('rejects stale responses', () => {
    const loading = climateReducer(initialClimateState, { type: 'FRAME_REQUEST', week: 8, requestId: 4 });
    expect(climateReducer(loading, { type: 'FRAME_SUCCESS', week: 7, requestId: 3, pair })).toBe(loading);
  });
  it('keeps transient and locked selections separate with locked precedence', () => {
    const hover = { value: 1, minimum: 0.5, maximum: 1.5, locked: false } satisfies LegendSelection;
    const locked = { value: 5, minimum: 4.5, maximum: 5.5, locked: true } satisfies LegendSelection;
    const state = climateReducer(climateReducer(initialClimateState, { type: 'SET_LEGEND_HOVER', selection: hover }), { type: 'SET_LEGEND_LOCK', selection: locked });
    expect(state.legendHover).toBeNull(); expect(effectiveLegendSelection(state)).toBe(locked);
  });
  it('keeps the active frame after a recoverable frame error', () => {
    const state = { ...initialClimateState, framePair: pair, activeRequestId: 2 };
    expect(climateReducer(state, { type: 'FRAME_ERROR', requestId: 2, message: 'network' })).toMatchObject({ framePair: pair, loadState: { status: 'error', recoverable: true } });
  });
});
