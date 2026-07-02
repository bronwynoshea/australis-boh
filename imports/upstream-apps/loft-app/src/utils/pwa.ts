export function isStandalonePwa(): boolean {
  const w = window as any;
  const isDisplayModeStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;

  // iOS Safari standalone
  const isIOSStandalone = Boolean(w.navigator?.standalone);

  return isDisplayModeStandalone || isIOSStandalone;
}

export function isMobile(): boolean {
  return window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
}
