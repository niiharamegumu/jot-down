import type { MouseEvent } from 'react';

export function openLinkFromCommandClick(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented || event.button !== 0 || !event.metaKey) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement) || !event.currentTarget.contains(anchor)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const openedWindow = window.open(anchor.href, '_blank', 'noopener,noreferrer');
  if (openedWindow) {
    openedWindow.opener = null;
  }

  return true;
}
