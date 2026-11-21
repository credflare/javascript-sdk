import type {FaceLandmarker, FaceLandmarkerResult} from '@mediapipe/tasks-vision';
import type {FaceSample} from './engine.js';
import type {FaceSignalProvider} from './faces.js';

export interface MediaPipeProviderOptions {
  load?: () => Promise<unknown>;
  wasmBaseUrl?: string;
  modelAssetPath?: string;
  delegate?: 'GPU' | 'CPU';
  intervalMs?: number;
}
export interface MediaPipeResultLike {
  faceLandmarks: ReadonlyArray<ReadonlyArray<{x: number; y: number}>>;
  faceBlendshapes: ReadonlyArray<{categories: ReadonlyArray<{categoryName: string; score: number}>}>;
  facialTransformationMatrixes?: ReadonlyArray<{data: ArrayLike<number>}>;
}

export const MEDIAPIPE_VERSION = '0.10.32';
export const defaultMediaPipeWasm = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const defaultMediaPipeModel = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const toDegrees = (radians: number) => radians * 180 / Math.PI;
const clamp = (value: number) => Math.min(1, Math.max(-1, value));

export function normalizeMediaPipeResult(result: MediaPipeResultLike, t: number): FaceSample {
  const faces = result.faceLandmarks.length;
  const landmarks = result.faceLandmarks[0];
  if (!faces || !landmarks?.length) return {t, faces: 0, box: null, eye_open: null, smile: null, yaw: null, pitch: null};
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(1, maxX); maxY = Math.min(1, maxY);
  const scores = new Map((result.faceBlendshapes[0]?.categories ?? []).map(item => [item.categoryName, item.score]));
  const mean = (a: string, b: string) => scores.has(a) && scores.has(b) ? (scores.get(a)! + scores.get(b)!) / 2 : null;
  const blink = mean('eyeBlinkLeft', 'eyeBlinkRight');
  const smile = mean('mouthSmileLeft', 'mouthSmileRight');
  const m = result.facialTransformationMatrixes?.[0]?.data;
  const angles = m && m.length >= 16
    ? {yaw: toDegrees(Math.atan2(m[8]!, m[10]!)), pitch: toDegrees(Math.asin(clamp(m[9]!)))}
    : {yaw: null, pitch: null};
  return {
    t,
    faces,
    box: {x: minX, y: minY, w: maxX - minX, h: maxY - minY},
    eye_open: blink === null ? null : 1 - blink,
    smile,
    ...angles,
  };
}

type VisionModule = {
  FilesetResolver: {forVisionTasks(basePath?: string): Promise<unknown>};
  FaceLandmarker: {createFromOptions(fileset: unknown, options: Record<string, unknown>): Promise<FaceLandmarker>};
};

let shared: Promise<FaceLandmarker> | null = null;
async function landmarker(options: MediaPipeProviderOptions): Promise<FaceLandmarker> {
  shared ??= (async () => {
    const vision = (await (options.load ?? (() => import('@mediapipe/tasks-vision')))()) as VisionModule;
    const fileset = await vision.FilesetResolver.forVisionTasks(options.wasmBaseUrl ?? defaultMediaPipeWasm);
    let failure: unknown;
    for (const delegate of options.delegate ? [options.delegate] : ['GPU', 'CPU'] as const) {
      try {
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {modelAssetPath: options.modelAssetPath ?? defaultMediaPipeModel, delegate},
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
      } catch (error) { failure = error; }
    }
    throw failure instanceof Error ? failure : new Error('The face model could not be loaded.');
  })().catch(error => { shared = null; throw error; });
  return shared;
}

export function createMediaPipeProvider(options: MediaPipeProviderOptions = {}): FaceSignalProvider<HTMLVideoElement> {
  return {
    name: 'mediapipe',
    async start(video, onSample, onError) {
      const detector = await landmarker(options);
      let stopped = false, lastTime = -1, timer: ReturnType<typeof setTimeout> | undefined;
      const tick = () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            const now = performance.now();
            const time = now > lastTime ? now : lastTime + 1;
            lastTime = time;
            const result: FaceLandmarkerResult = detector.detectForVideo(video, time);
            onSample(normalizeMediaPipeResult(result, time));
          }
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Face detection failed.'));
        }
        timer = setTimeout(tick, options.intervalMs ?? 66);
      };
      tick();
      return () => { stopped = true; if (timer) clearTimeout(timer); };
    },
  };
}
