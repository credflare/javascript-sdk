import {liveness as livenessSpec} from './spec.generated.js';
import type {CopyKey, GestureName} from './spec.generated.js';

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface FaceSample {
  t: number;
  faces: number;
  box: FaceBox | null;
  eye_open: number | null;
  smile: number | null;
  yaw: number | null;
  pitch: number | null;
}
export type FaceProviderName = 'vision' | 'mlkit' | 'mediapipe' | 'default';
export type PositionStatus = 'no_face' | 'multiple_faces' | 'too_small' | 'too_large' | 'off_center' | 'ok';
export type Signal = 'eye_open' | 'smile' | 'yaw' | 'pitch';
export interface GestureStep {
  readonly signal: Signal;
  readonly op: 'gt' | 'lt' | 'lt_neg' | 'abs_lt';
  readonly value: string | number;
  readonly hold_frames?: string | number;
}
export interface LivenessRules {
  readonly gesture_timeout_ms: number;
  readonly face_lost_reset_ms: number;
  readonly position: {readonly face_area_min: number; readonly face_area_max: number; readonly center_tolerance: number; readonly faces: number};
  readonly thresholds: {readonly default: Readonly<Record<string, number>>} & Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly gestures: Readonly<Record<string, readonly GestureStep[]>>;
}
export type RunState = 'running' | 'pass' | 'timeout';
export interface PositionResult {
  state: RunState;
  status: PositionStatus;
  t?: number;
}
export interface GestureResult {
  state: RunState;
  step: number;
  tracked?: boolean;
  t?: number;
}

export const defaultLiveness: LivenessRules = livenessSpec as unknown as LivenessRules;

export const positionCopyKey: Record<PositionStatus, CopyKey> = {
  no_face: 'liveness.position.no_face',
  multiple_faces: 'liveness.position.one_face',
  too_small: 'liveness.position.move_closer',
  too_large: 'liveness.position.move_further',
  off_center: 'liveness.position.center',
  ok: 'liveness.position.ready',
};

export function resolveThresholds(rules: LivenessRules, provider: string): Record<string, number> {
  return {...rules.thresholds.default, ...(rules.thresholds[provider] ?? {})};
}

function lookup(thresholds: Record<string, number>, value: string | number): number {
  if (typeof value === 'number') return value;
  const resolved = thresholds[value];
  if (resolved === undefined) throw new Error(`Unknown threshold ${value}`);
  return resolved;
}

export function testStep(step: GestureStep, sample: FaceSample, thresholds: Record<string, number>): boolean {
  const s = sample[step.signal];
  if (s === null || s === undefined) return false;
  const v = lookup(thresholds, step.value);
  switch (step.op) {
    case 'gt': return s > v;
    case 'lt': return s < v;
    case 'lt_neg': return s < -v;
    case 'abs_lt': return Math.abs(s) < v;
  }
}

export function positionStatus(sample: FaceSample, position: LivenessRules['position']): PositionStatus {
  if (sample.faces === 0 || !sample.box) return 'no_face';
  if (sample.faces > position.faces) return 'multiple_faces';
  const {x, y, w, h} = sample.box;
  const area = w * h;
  if (area < position.face_area_min) return 'too_small';
  if (area > position.face_area_max) return 'too_large';
  if (Math.abs(x + w / 2 - 0.5) > position.center_tolerance || Math.abs(y + h / 2 - 0.5) > position.center_tolerance) return 'off_center';
  return 'ok';
}

export function createPositionGate(rules: LivenessRules = defaultLiveness) {
  let start: number | null = null;
  let done = false;
  return {
    push(sample: FaceSample): PositionResult {
      if (done) throw new Error('Position gate already finished');
      if (start === null) start = sample.t;
      const status = positionStatus(sample, rules.position);
      if (sample.t - start >= rules.gesture_timeout_ms) {
        done = true;
        return {state: 'timeout', status};
      }
      if (status === 'ok') {
        done = true;
        return {state: 'pass', status, t: sample.t};
      }
      return {state: 'running', status};
    },
  };
}

export function createGestureRun(gesture: string, provider: string = 'default', rules: LivenessRules = defaultLiveness) {
  const steps = rules.gestures[gesture];
  if (!steps) throw new Error(`Unknown gesture ${gesture}`);
  const thresholds = resolveThresholds(rules, provider);
  const resetMs = rules.face_lost_reset_ms;
  let start: number | null = null, prevT: number | null = null, lostSince: number | null = null;
  let index = 0, count = 0, done = false;
  return {
    get step() { return index; },
    get steps() { return steps.length; },
    push(sample: FaceSample): GestureResult {
      if (done) throw new Error('Gesture run already finished');
      if (start === null) start = sample.t;
      if (sample.t - start >= rules.gesture_timeout_ms) {
        done = true;
        return {state: 'timeout', step: index};
      }
      const gap = prevT !== null && sample.t - prevT >= resetMs;
      prevT = sample.t;
      if (sample.faces !== 1) {
        count = 0;
        if (lostSince === null) lostSince = sample.t;
        if (sample.t - lostSince >= resetMs) index = 0;
        return {state: 'running', step: index, tracked: false};
      }
      if (gap || (lostSince !== null && sample.t - lostSince >= resetMs)) {
        index = 0;
        count = 0;
      }
      lostSince = null;
      const step = steps[index]!;
      if (testStep(step, sample, thresholds)) {
        count += 1;
        const hold = step.hold_frames === undefined ? 1 : lookup(thresholds, step.hold_frames);
        if (count >= hold) {
          index += 1;
          count = 0;
          if (index === steps.length) {
            done = true;
            return {state: 'pass', step: index, t: sample.t};
          }
        }
      } else {
        count = 0;
      }
      return {state: 'running', step: index, tracked: true};
    },
  };
}

export interface LivenessTrace {
  gesture: string;
  provider?: string;
  samples: FaceSample[];
}
export function runTrace(trace: LivenessTrace, rules: LivenessRules = defaultLiveness): {outcome: 'pass' | 'fail' | 'timeout'; t?: number; status?: PositionStatus; step?: number} {
  const run = trace.gesture === 'position' ? createPositionGate(rules) : createGestureRun(trace.gesture, trace.provider ?? 'default', rules);
  let last: PositionResult | GestureResult | null = null;
  for (const sample of trace.samples) {
    last = run.push(sample);
    if (last.state !== 'running') break;
  }
  return {
    outcome: last && last.state !== 'running' ? last.state : 'fail',
    t: last?.t,
    status: last && 'status' in last ? last.status : undefined,
    step: last && 'step' in last ? last.step : undefined,
  };
}

export type ChallengeStage = 'position' | 'gesture' | 'pass' | 'timeout' | 'expired';
export interface ChallengeUpdate {
  stage: ChallengeStage;
  gestureIndex: number;
  gesture: GestureName | null;
  step: number;
  status: PositionStatus | null;
  tracked: boolean;
  completed: {gesture: GestureName; index: number; t: number} | null;
  hint: CopyKey;
}

export function gestureCopyKey(gesture: GestureName): CopyKey {
  return `liveness.gesture.${gesture}` as CopyKey;
}

export function createChallengeRun(options: {gestures: readonly GestureName[]; provider: string; expiresAt?: number | null; now?: () => number; rules?: LivenessRules}) {
  const rules = options.rules ?? defaultLiveness;
  const now = options.now ?? Date.now;
  let gate: ReturnType<typeof createPositionGate> | null = createPositionGate(rules);
  let run: ReturnType<typeof createGestureRun> | null = null;
  let gestureIndex = 0;
  let stage: ChallengeStage = 'position';
  const update = (patch: Partial<ChallengeUpdate>): ChallengeUpdate => {
    const gesture = stage === 'gesture' ? options.gestures[gestureIndex] ?? null : null;
    return {
      stage, gestureIndex, gesture, step: run?.step ?? 0, status: null, tracked: true, completed: null,
      hint: stage === 'timeout' ? 'liveness.timeout' : stage === 'expired' ? 'liveness.expired' : stage === 'pass' ? 'liveness.success' : gesture ? gestureCopyKey(gesture) : 'liveness.position.no_face',
      ...patch,
    };
  };
  return {
    get stage() { return stage; },
    push(sample: FaceSample): ChallengeUpdate {
      if (stage === 'pass' || stage === 'timeout' || stage === 'expired') throw new Error('Challenge run already finished');
      if (options.expiresAt != null && now() >= options.expiresAt) {
        stage = 'expired';
        return update({});
      }
      if (stage === 'position') {
        const result = gate!.push(sample);
        if (result.state === 'timeout') {
          stage = 'timeout';
          return update({status: result.status});
        }
        if (result.state === 'pass') {
          gate = null;
          stage = 'gesture';
          run = createGestureRun(options.gestures[0]!, options.provider, rules);
          return update({status: 'ok', hint: positionCopyKey.ok});
        }
        return update({status: result.status, hint: positionCopyKey[result.status], tracked: result.status !== 'no_face' && result.status !== 'multiple_faces'});
      }
      const result = run!.push(sample);
      if (result.state === 'timeout') {
        stage = 'timeout';
        return update({});
      }
      if (result.state === 'pass') {
        const completed = {gesture: options.gestures[gestureIndex]!, index: gestureIndex, t: sample.t};
        gestureIndex += 1;
        if (gestureIndex >= options.gestures.length) {
          stage = 'pass';
          run = null;
          return update({completed, gestureIndex: completed.index});
        }
        run = createGestureRun(options.gestures[gestureIndex]!, options.provider, rules);
        return update({completed});
      }
      return update({tracked: result.tracked !== false, hint: result.tracked === false ? 'liveness.face_lost' : gestureCopyKey(options.gestures[gestureIndex]!)});
    },
  };
}
