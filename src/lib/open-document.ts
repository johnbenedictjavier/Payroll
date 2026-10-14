export function openDocumentUrl(url: string) {
  // Do not pre-open an empty tab. Popup blockers otherwise leave an unusable about:blank tab.
  return Boolean(window.open(url, '_blank', 'noopener,noreferrer'))
}
