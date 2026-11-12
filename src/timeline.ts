import { questions } from "./questions";

export const roundSeconds = 60;
export const loopSeconds = roundSeconds * questions.length;
export const musicSeconds = 180;
export const fps = 30;

export function timeline(seconds: number) {
  const elapsed = ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
  const index = Math.floor(elapsed / roundSeconds);
  const time = elapsed - index * roundSeconds;
  const phase = time < 5 ? "question" : time < 10 ? "choices" : time < 30 ? "countdown"
    : time < 36 ? "reveal" : time < 55 ? "explanation" : "transition";
  return { index, time, phase, remaining: Math.max(0, Math.ceil(30 - time)) };
}

export function ease(value: number, from: number, to: number) {
  const x = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return x * x * (3 - 2 * x);
}

export function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}
