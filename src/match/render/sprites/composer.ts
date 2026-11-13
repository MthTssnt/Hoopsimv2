import type { Appearance } from './appearance';
import { composePlayer, type ComposedPlayer } from './composePlayer';

/** One worker per match; bounded queue, released before tip-off or on scene shutdown. */
export class PlayerComposer {
  readonly mode: 'worker' | 'main';
  private worker: Worker | null = null;
  private serial = 0;
  private pending = new Map<number, { resolve: (value: ComposedPlayer) => void; reject: (error: Error) => void }>();
  private closed = false;
  private sources: HTMLImageElement[];
  constructor(sources: HTMLImageElement[], useWorker = true) {
    this.sources = sources;
    this.mode = useWorker && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined' ? 'worker' : 'main';
  }
  async init(): Promise<void> {
    if (this.mode !== 'worker') return;
    this.worker = new Worker(new URL('./compose.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent<{ id: number; result: ComposedPlayer; error?: string }>) => {
      const job = this.pending.get(data.id);
      if (!job) {
        if (data.result?.atlas instanceof ImageBitmap) data.result.atlas.close();
        if (data.result?.hands instanceof ImageBitmap) data.result.hands.close();
        return;
      }
      this.pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message || 'La composition des joueurs a échoué.'));
    const images = await Promise.all(this.sources.map((source) => createImageBitmap(source)));
    if (this.closed) { images.forEach((image) => image.close()); throw new Error('Composition interrompue.'); }
    this.worker.postMessage({ sources: images }, images);
  }
  async compose(look: Appearance, team: number): Promise<ComposedPlayer> {
    if (this.closed) throw new Error('Composition interrompue.');
    if (this.mode === 'main') {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (this.closed) throw new Error('Composition interrompue.');
      return composePlayer(this.sources, look, team);
    }
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, look, team });
    });
  }
  private fail(error: Error) {
    this.pending.forEach((job) => job.reject(error)); this.pending.clear();
    this.closed = true; this.worker?.terminate(); this.worker = null;
  }
  close(): void { this.fail(new Error('Composition interrompue.')); }
}
