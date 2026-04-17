// src/lib/captions/animations.ts
// Animation utils para preview CSS puro (sem Remotion)

export interface SpringConfig {
  damping?: number;
  mass?: number;
  stiffness?: number;
  overshootClamping?: boolean;
}

export function spring(frame: number, fps: number, config: SpringConfig = {}): number {
  const { damping = 10, mass = 1, stiffness = 100, overshootClamping = false } = config;
  if (frame <= 0) return 0;

  const dt = 1 / fps;
  let position = 0;
  let velocity = 0;
  const target = 1;

  for (let i = 0; i < frame; i++) {
    const springForce = -stiffness * (position - target);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;
    velocity += acceleration * dt;
    position += velocity * dt;

    if (overshootClamping && position > target) {
      position = target;
      velocity = 0;
    }
  }

  return position;
}

export function interpolate(
  value: number,
  inputRange: [number, number],
  outputRange: [number, number],
  options: { extrapolate?: 'clamp' | 'extend' } = {}
): number {
  const { extrapolate = 'extend' } = options;
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;

  if (inMax === inMin) return outMin;

  let t = (value - inMin) / (inMax - inMin);

  if (extrapolate === 'clamp') {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
  }

  return outMin + t * (outMax - outMin);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
