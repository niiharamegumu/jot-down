const linkDialogActionSelector = [
  'button[aria-label="Edit link URL"]',
  'button[aria-label="Copy to clipboard"]',
  'button[aria-label="Remove link"]'
].join(',');

export function isMdxEditorFloatingUiElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const dialog = target.closest('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) {
    return false;
  }

  return (
    dialog.className.includes('linkDialog') ||
    Boolean(
      dialog.querySelector(
        [linkDialogActionSelector, 'a[target="_blank"][rel~="noreferrer"]'].join(',')
      )
    )
  );
}

export function preserveMdxEditorFocusForFloatingUi(event: MouseEvent | PointerEvent) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const action = event.target.closest(linkDialogActionSelector);
  if (action && isMdxEditorFloatingUiElement(action)) {
    event.preventDefault();
  }
}

export function installMdxEditorFloatingUiFixes(): () => void {
  markMdxEditorFloatingUiElements();
  document.addEventListener('mousedown', preserveMdxEditorFocusForFloatingUi, true);

  const observer = new MutationObserver(markMdxEditorFloatingUiElements);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    document.removeEventListener('mousedown', preserveMdxEditorFocusForFloatingUi, true);
  };
}

function markMdxEditorFloatingUiElements() {
  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    if (isMdxEditorFloatingUiElement(dialog)) {
      dialog.setAttribute('data-editor-dialog', 'true');
    }
  }
}
