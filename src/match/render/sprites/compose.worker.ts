import { composePlayer } from './composePlayer';
import type { Appearance } from './appearance';

let sources: ImageBitmap[] = [];
self.onmessage = (event: MessageEvent<{ sources?: ImageBitmap[]; id: number; look: Appearance; team: number }>) => {
  const request = event.data;
  if (request.sources) { sources = request.sources; return; }
  try {
    const result = composePlayer(sources, request.look, request.team);
    const atlas = (result.atlas as OffscreenCanvas).transferToImageBitmap();
    const hands = (result.hands as OffscreenCanvas).transferToImageBitmap();
    self.postMessage({ id: request.id, result: { ...result, atlas, hands } }, { transfer: [atlas, hands] });
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
};
