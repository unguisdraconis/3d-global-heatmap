import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RenderStyleControl } from './RenderStyleControl';

describe('RenderStyleControl', () => {
  it('exposes the current style and requests the smooth style', async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<RenderStyleControl value="heatmap" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /native grid/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /clean/i }));
    expect(onChange).toHaveBeenCalledWith('smooth');
  });
});
