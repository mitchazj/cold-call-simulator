// Minimal promise-based tweening.
const active = new Set();

export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
};

/** tween(seconds, (k) => {...}, easing) → Promise */
export function tween(secs, fn, easing = ease.inOut) {
  return new Promise((resolve) => {
    active.add({ t: 0, secs, fn, easing, resolve });
  });
}

export const wait = (secs) => tween(secs, () => {});

export function updateTweens(dt) {
  for (const tw of active) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.secs);
    tw.fn(tw.easing(k), k);
    if (k >= 1) {
      active.delete(tw);
      tw.resolve();
    }
  }
}
