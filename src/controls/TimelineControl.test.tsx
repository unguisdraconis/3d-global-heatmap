import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineControl, TIMELINE_SCRUB_DELAY_MS } from './TimelineControl';

function renderTimeline(onWeek = vi.fn()) {
  const view = render(<TimelineControl
    week={0}
    frameCount={52}
    loading={false}
    onWeek={onWeek}
  />);
  return { ...view, onWeek };
}

afterEach(() => vi.useRealTimers());

describe('TimelineControl slider scrubbing', () => {
  it('renders a stable reference-period marker for a single-frame dataset', () => {
    render(<TimelineControl week={0} frameCount={1} loading={false} onWeek={vi.fn()} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByText(/verified reference week/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous week/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next week/i })).toBeDisabled();
  });

  it('moves immediately but waits for input to settle before loading a week', async () => {
    vi.useFakeTimers();
    const { onWeek } = renderTimeline();
    const slider = screen.getByRole('slider', { name: /week of year/i });

    fireEvent.change(slider, { target: { value: '12' } });
    expect(slider).toHaveValue('12');
    expect(slider).toHaveAttribute('aria-valuetext', 'Week 13 of 52');
    expect(onWeek).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTime(TIMELINE_SCRUB_DELAY_MS - 1));
    expect(onWeek).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(1));
    expect(onWeek).toHaveBeenCalledOnce();
    expect(onWeek).toHaveBeenCalledWith(12);
  });

  it('commits the native frame immediately when pointer motion ends', () => {
    const { onWeek } = renderTimeline();
    const slider = screen.getByRole('slider', { name: /week of year/i });
    fireEvent.change(slider, { target: { value: '22' } });
    fireEvent.pointerUp(slider);
    expect(onWeek).toHaveBeenCalledOnce();
    expect(onWeek).toHaveBeenCalledWith(22);
  });

  it('resets the delay after every movement and loads only the final week', async () => {
    vi.useFakeTimers();
    const { onWeek } = renderTimeline();
    const slider = screen.getByRole('slider', { name: /week of year/i });

    fireEvent.change(slider, { target: { value: '8' } });
    await act(() => vi.advanceTimersByTime(TIMELINE_SCRUB_DELAY_MS - 50));
    fireEvent.change(slider, { target: { value: '31' } });
    await act(() => vi.advanceTimersByTime(TIMELINE_SCRUB_DELAY_MS));

    expect(onWeek).toHaveBeenCalledOnce();
    expect(onWeek).toHaveBeenCalledWith(31);
  });

  it('keeps previous and next buttons immediate', () => {
    const { onWeek } = renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: /previous week/i }));
    expect(onWeek).toHaveBeenCalledWith(51);
    fireEvent.click(screen.getByRole('button', { name: /next week/i }));
    expect(onWeek).toHaveBeenCalledWith(1);
  });
});
