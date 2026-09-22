import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FrameHistograms, LegendSelection } from '../climate/types';
import { TemperatureLegend } from './TemperatureLegend';

const bins = Array.from({ length: 280 }, () => 1);
const histograms: FrameHistograms = { binMinimum: -80, binWidth: 0.5, areaTotal: 280, landArea: 280, oceanArea: 280, land: bins, ocean: bins, combined: bins };
const props = { histograms, mode: 'composite' as const, unit: 'C' as const, globeValue: 12, hover: null, locked: null };

describe('TemperatureLegend interaction', () => {
  it('creates transient pointer ranges and locks them on activation', () => {
    const onHover = vi.fn(); const onLock = vi.fn();
    render(<TemperatureLegend {...props} onHover={onHover} onLock={onLock} />);
    const slider = screen.getByRole('slider');
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 760, top: 0, bottom: 108, right: 760, height: 108, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(slider, { clientX: 380 });
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ locked: false, value: -10 }));
    fireEvent.click(slider, { clientX: 380 });
    expect(onLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true, value: -10 }));
  });
  it('supports arrow keys, lock, and clear', async () => {
    const user = userEvent.setup(); const onHover = vi.fn(); const onLock = vi.fn();
    const { rerender } = render(<TemperatureLegend {...props} onHover={onHover} onLock={onLock} />); const slider = screen.getByRole('slider');
    slider.focus(); await user.keyboard('{ArrowRight}{Enter}');
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ value: 0.5 })); expect(onLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true, value: 0.5 }));
    const locked = { value: 0.5, minimum: 0, maximum: 1, locked: true } satisfies LegendSelection;
    rerender(<TemperatureLegend {...props} locked={locked} onHover={onHover} onLock={onLock} />);
    await user.click(screen.getByRole('button', { name: /clear selected/i })); expect(onLock).toHaveBeenLastCalledWith(null);
  });
  it('exposes Fahrenheit slider values and a globe-hover marker', () => {
    render(<TemperatureLegend {...props} unit="F" globeValue={20} onHover={vi.fn()} onLock={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemin', '-112');
    expect(screen.getByTestId('temperature-marker')).toBeInTheDocument();
  });
});
