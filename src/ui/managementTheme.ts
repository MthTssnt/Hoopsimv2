/** Presentation only. The temporary default can be changed without touching career saves. */
export function managementTheme(search = window.location.search): 'clubhouse' | 'arcade' | 'almanac' {
  const selected=new URLSearchParams(search).get('ux-style');return selected==='almanac'?'almanac':selected==='arcade'?'arcade':'clubhouse';
}
