import type {FaceProviderName, FaceSample} from './engine.js';

export interface FaceSignalProvider<Input = unknown> {
  readonly name: FaceProviderName;
  start(input: Input, onSample: (sample: FaceSample) => void, onError?: (error: Error) => void): Promise<() => void>;
}

export function createReplayProvider<Input = unknown>(
  samples: readonly FaceSample[] | ((index: number) => FaceSample | null),
  options: {name?: FaceProviderName; intervalMs?: number} = {},
): FaceSignalProvider<Input> {
  const at = typeof samples === 'function' ? samples : (index: number) => samples[index] ?? null;
  return {
    name: options.name ?? 'default',
    async start(_input, onSample) {
      let index = 0, stopped = false;
      const tick = () => {
        if (stopped) return;
        const sample = at(index);
        if (!sample) return;
        index += 1;
        onSample(sample);
        timer = setTimeout(tick, options.intervalMs ?? 66);
      };
      let timer: ReturnType<typeof setTimeout> = setTimeout(tick, 0);
      return () => { stopped = true; clearTimeout(timer); };
    },
  };
}
