import { selectMdxEditorTextOffset } from './mdxEditorSelectionPlugin';

const linkDialogActionSelector = [
  'button[aria-label="Edit link URL"]',
  'button[aria-label="Copy to clipboard"]',
  'button[aria-label="Remove link"]'
].join(',');

let hoveredEditorLink: HTMLAnchorElement | null = null;
let hoveredLinkDialog: HTMLElement | null = null;
let linkPreviewHideTimeoutId: number | null = null;

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
  document.addEventListener('pointerover', trackEditorLinkHover, true);
  document.addEventListener('pointerout', clearEditorLinkHover, true);
  document.addEventListener('pointermove', reconcileLinkHoverTarget, true);

  const observer = new MutationObserver(markMdxEditorFloatingUiElements);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    document.removeEventListener('mousedown', preserveMdxEditorFocusForFloatingUi, true);
    document.removeEventListener('pointerover', trackEditorLinkHover, true);
    document.removeEventListener('pointerout', clearEditorLinkHover, true);
    document.removeEventListener('pointermove', reconcileLinkHoverTarget, true);
    hoveredEditorLink = null;
    hoveredLinkDialog = null;
    cancelScheduledLinkPreviewHide();
  };
}

function markMdxEditorFloatingUiElements() {
  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    if (isMdxEditorFloatingUiElement(dialog)) {
      dialog.setAttribute('data-editor-dialog', 'true');
      if (isLinkPreviewDialog(dialog)) {
        dialog.toggleAttribute('data-editor-link-dialog-hidden', !shouldShowLinkPreviewDialog());
      } else {
        dialog.removeAttribute('data-editor-link-dialog-hidden');
      }
    }
  }
}

function trackEditorLinkHover(event: PointerEvent) {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest('.jot-editor a[href]');
  if (link instanceof HTMLAnchorElement) {
    cancelScheduledLinkPreviewHide();
    hoveredEditorLink = link;
    selectMdxEditorTextOffset(link, 0);
    markMdxEditorFloatingUiElements();
    return;
  }

  const dialog = target?.closest('[role="dialog"]');
  if (dialog instanceof HTMLElement && isLinkPreviewDialog(dialog)) {
    cancelScheduledLinkPreviewHide();
    hoveredLinkDialog = dialog;
    markMdxEditorFloatingUiElements();
  }
}

function clearEditorLinkHover(event: PointerEvent) {
  const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;

  if (isEditorLink(relatedTarget) || isInsideLinkPreviewDialog(relatedTarget)) {
    return;
  }

  scheduleLinkPreviewHide();
}

function reconcileLinkHoverTarget(event: PointerEvent) {
  const target = event.target instanceof Node ? event.target : null;
  if (isEditorLink(target) || isInsideLinkPreviewDialog(target)) {
    cancelScheduledLinkPreviewHide();
    return;
  }

  if (hoveredEditorLink || hoveredLinkDialog) {
    scheduleLinkPreviewHide();
  }
}

function shouldShowLinkPreviewDialog(): boolean {
  return Boolean(hoveredEditorLink?.isConnected || hoveredLinkDialog?.isConnected);
}

function isLinkPreviewDialog(dialog: Element): boolean {
  return Boolean(dialog.querySelector('a[target="_blank"][rel~="noreferrer"]'));
}

function isInsideLinkPreviewDialog(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  const dialog = element?.closest('[role="dialog"]');
  return dialog instanceof HTMLElement && isLinkPreviewDialog(dialog);
}

function isEditorLink(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest('.jot-editor a[href]') instanceof HTMLAnchorElement;
}

function scheduleLinkPreviewHide() {
  if (linkPreviewHideTimeoutId !== null) {
    return;
  }

  linkPreviewHideTimeoutId = window.setTimeout(() => {
    linkPreviewHideTimeoutId = null;
    hoveredEditorLink = null;
    hoveredLinkDialog = null;
    markMdxEditorFloatingUiElements();
  }, 80);
}

function cancelScheduledLinkPreviewHide() {
  if (linkPreviewHideTimeoutId === null) {
    return;
  }

  window.clearTimeout(linkPreviewHideTimeoutId);
  linkPreviewHideTimeoutId = null;
}
