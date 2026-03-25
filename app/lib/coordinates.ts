import * as THREE from "three";

export interface LocationPoint {
  x: number;
  y: number;
  z: number;
  date: string;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function getBoundingBox(points: { x: number; y: number; z?: number }[]): BoundingBox {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    const z = p.z ?? 0;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Normalize a value from [srcMin, srcMax] to [dstMin, dstMax].
 */
function remap(value: number, srcMin: number, srcMax: number, dstMin: number, dstMax: number): number {
  const srcRange = srcMax - srcMin;
  if (srcRange === 0) return (dstMin + dstMax) / 2;
  return dstMin + ((value - srcMin) / srcRange) * (dstMax - dstMin);
}

const SCENE_SIZE = 100; // scene fits within -50..50

/**
 * Filter out invalid/zero location points (car not on track).
 */
export function filterValidLocationPoints(points: LocationPoint[]): LocationPoint[] {
  return points.filter((p) => p.x !== 0 || p.y !== 0);
}

/**
 * Normalize OpenF1 location points into scene coordinates.
 * X maps to Three.js X, Y maps to Three.js Z (ground plane), Z maps to Three.js Y (up).
 */
export function normalizeLocationPoints(
  points: LocationPoint[]
): THREE.Vector3[] {
  // Filter out zero/invalid points
  const valid = filterValidLocationPoints(points);
  if (valid.length === 0) return [];

  const bbox = getBoundingBox(valid);

  // Preserve aspect ratio
  const rangeX = bbox.maxX - bbox.minX;
  const rangeY = bbox.maxY - bbox.minY;
  const maxRange = Math.max(rangeX, rangeY);
  const halfScene = SCENE_SIZE / 2;

  return valid.map((p) => {
    const x = remap(p.x, bbox.minX, bbox.minX + maxRange, -halfScene, halfScene);
    // Negate Z so north (high Y) maps to negative Three.js Z ("up" in bird's-eye view)
    const z = remap(p.y, bbox.minY, bbox.minY + maxRange, halfScene, -halfScene);
    // Elevation — scale proportionally; exaggerate slightly so hills are visible
    const y = remap(p.z, bbox.minZ, bbox.maxZ, 0, 8);
    return new THREE.Vector3(x, y, z);
  });
}

/**
 * Normalise circuit centerline points into scene coordinates.
 * If elevationZ is provided (raw OpenF1 z units), Y is mapped to [0, 8] using
 * the same scale as normalizeLocationPoints so the track and car markers align.
 */
export function normalizeCircuitPoints(
  circuitPoints: { x: number; y: number }[],
  referenceBbox?: BoundingBox,
  elevationZ?: number[]
): THREE.Vector3[] {
  const bbox = referenceBbox ?? getBoundingBox(circuitPoints);
  const rangeX = bbox.maxX - bbox.minX;
  const rangeY = bbox.maxY - bbox.minY;
  const maxRange = Math.max(rangeX, rangeY);
  const halfScene = SCENE_SIZE / 2;

  // Compute z bounds for elevation (if provided)
  let zMin = 0, zMax = 1;
  if (elevationZ && elevationZ.length > 0) {
    zMin = Math.min(...elevationZ);
    zMax = Math.max(...elevationZ);
  }

  return circuitPoints.map((p, i) => {
    const x = remap(p.x, bbox.minX, bbox.minX + maxRange, -halfScene, halfScene);
    // Negate Z so north (high Y) maps to negative Three.js Z ("up" in bird's-eye view)
    const z = remap(p.y, bbox.minY, bbox.minY + maxRange, halfScene, -halfScene);
    const y = elevationZ ? remap(elevationZ[i], zMin, zMax, 0, 8) : 0;
    return new THREE.Vector3(x, y, z);
  });
}

/**
 * Given a sorted array of location points (by date) and a timestamp,
 * interpolate the 3D position. Returns normalized scene coordinates.
 */
export function interpolatePosition(
  normalizedPoints: THREE.Vector3[],
  timestamps: number[],
  timeMs: number
): THREE.Vector3 {
  if (normalizedPoints.length === 0) return new THREE.Vector3();
  if (timeMs <= timestamps[0]) return normalizedPoints[0].clone();
  if (timeMs >= timestamps[timestamps.length - 1])
    return normalizedPoints[normalizedPoints.length - 1].clone();

  // Binary search for surrounding indices
  let lo = 0;
  let hi = timestamps.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] <= timeMs) lo = mid;
    else hi = mid;
  }

  const t =
    (timeMs - timestamps[lo]) / (timestamps[hi] - timestamps[lo]);

  return normalizedPoints[lo].clone().lerp(normalizedPoints[hi], t);
}

/**
 * Extract a single lap of location points from the full race data.
 * Uses a simple heuristic: find where car returns near the start position.
 */
export function extractSingleLap(points: LocationPoint[]): LocationPoint[] {
  // Filter out zero points first
  const valid = filterValidLocationPoints(points);
  if (valid.length < 100) return valid;

  const start = valid[0];
  const threshold = 500;

  // Skip the first ~5% then look for a return to start
  const skipCount = Math.floor(valid.length * 0.03);
  const searchEnd = Math.min(valid.length, Math.floor(valid.length * 0.08));

  for (let i = skipCount; i < searchEnd; i++) {
    const dx = valid[i].x - start.x;
    const dy = valid[i].y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < threshold) {
      return valid.slice(0, i);
    }
  }

  // If we can't find a lap boundary, return first ~5% of points
  return valid.slice(0, Math.floor(valid.length * 0.05));
}

/**
 * Map speed values to a color gradient (blue = slow, red = fast).
 */
export function speedToColor(speed: number, maxSpeed: number): THREE.Color {
  const t = Math.min(speed / maxSpeed, 1);
  // Blue (slow) -> Green (mid) -> Red (fast)
  if (t < 0.5) {
    const s = t * 2;
    return new THREE.Color(0, s, 1 - s);
  } else {
    const s = (t - 0.5) * 2;
    return new THREE.Color(s, 1 - s, 0);
  }
}
