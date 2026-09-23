import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../components/shell/CommandPalette';

describe('Global Command Palette (Ctrl+K)', () => {
  it('does not render dialog when isOpen is false', () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={false} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders search dialog and responds to search input when isOpen is true', () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    const input = screen.getByPlaceholderText(/Type a command/i);
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: 'Khata' } });
    expect(screen.getByText('Go to Digital Khata')).toBeDefined();
  });

  it('triggers onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalled();
  });
});
