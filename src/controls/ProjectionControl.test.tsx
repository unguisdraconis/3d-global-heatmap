import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectionControl } from './ProjectionControl';

describe('ProjectionControl', () => {
  it('exposes the active view and requests the Plate Carrée map', async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<ProjectionControl value="globe" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /globe/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /map/i }));
    expect(onChange).toHaveBeenCalledWith('map');
  });
});
