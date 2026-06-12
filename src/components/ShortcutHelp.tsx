type ShortcutHelpProps = {
  showNoteEditingShortcuts: boolean;
};

export function ShortcutHelp({ showNoteEditingShortcuts }: ShortcutHelpProps) {
  return (
    <button
      className="icon-button shortcut-help-button"
      type="button"
      aria-label="ショートカット一覧"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.6 2.6 0 0 1 5 1c0 1.7-1.8 2-2.4 3.2" />
        <path d="M12 17h.01" />
      </svg>
      <span className="shortcut-help-button__tooltip" role="tooltip">
        <span>
          <kbd>⌘ / Ctrl + K</kbd>
          <span>コマンドを開く</span>
        </span>
        {showNoteEditingShortcuts ? (
          <>
            <span>
              <kbd>⌘ + Enter</kbd>
              <span>タスクのチェックを切り替え</span>
            </span>
            <span>
              <kbd>⌥ + ↑</kbd>
              <span>行を上へ移動</span>
            </span>
            <span>
              <kbd>⌥ + ↓</kbd>
              <span>行を下へ移動</span>
            </span>
            <span>
              <kbd>⌃ + ⌥ + ↑</kbd>
              <span>行を先頭へ移動</span>
            </span>
            <span>
              <kbd>⌃ + ⌥ + ↓</kbd>
              <span>行を末尾へ移動</span>
            </span>
            <span>
              <kbd>⌘ + クリック</kbd>
              <span>リンクを開く</span>
            </span>
          </>
        ) : null}
      </span>
    </button>
  );
}
