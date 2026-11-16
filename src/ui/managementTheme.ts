/** Presentation only. The temporary default can be changed without touching career saves. */
export function managementTheme(search = window.location.search): 'arcade' | 'almanac' {
  return new URLSearchParams(search).get('ux-style') === 'almanac' ? 'almanac' : 'arcade';
}
