import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, type CommandPaletteAction } from './CommandPalette';

describe('CommandPalette', () => {
  it('scrolls the selected item into view while navigating with the keyboard', async () => {
    const actions = Array.from({ length: 12 }, (_, index): CommandPaletteAction => {
      const actionNumber = index + 1;
      return {
        id: `action-${actionNumber}`,
        label: `Action ${actionNumber}`,
        aliases: [],
        run: vi.fn()
      };
    });

    render(
      <CommandPalette
        open
        notes={[]}
        noteFolders={[]}
        actions={actions}
        templates={[]}
        onOpenNote={vi.fn()}
        onInsertTemplate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const results = document.querySelector<HTMLElement>('.command-palette__results');
    expect(results).not.toBeNull();
    if (!results) {
      return;
    }

    results.getBoundingClientRect = () => createRect({ top: 0, bottom: 96 });
    Object.defineProperty(results, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true
    });

    screen.getAllByRole('button').forEach((button, index) => {
      const top = index * 32;
      button.getBoundingClientRect = () => createRect({ top, bottom: top + 28 });
    });

    const input = screen.getByRole('textbox', { name: 'NoteやActionを検索' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => expect(results.scrollTop).toBeGreaterThan(0));
  });
});

function createRect({ top, bottom }: { top: number; bottom: number }): DOMRect {
  return {
    top,
    bottom,
    x: 0,
    y: top,
    left: 0,
    right: 300,
    width: 300,
    height: bottom - top,
    toJSON: () => ({})
  };
}
