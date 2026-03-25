/**
 * One-time data generation script.
 * Fetches COTA circuit geometry from MultiViewer, fetches OpenF1 location data
 * from ALL sessions in the 2025 US GP weekend, then merges the two datasets
 * using a radius median elevation lookup and writes public/data/circuit.json.
 *
 * Run with: node scripts/generate-circuit.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const MULTIVIEWER_URL = "https://api.multiviewer.app/api/v1/circuits/9/2025";
const OPENF1_BASE = "https://api.openf1.org/v1";

// 2025 US GP (COTA) — all sessions for maximum location data coverage
const SESSIONS = [
  { key: 9878, name: "Practice 1" },
  { key: 9879, name: "Sprint Qualifying" },
  { key: 9883, name: "Sprint" },
  { key: 9884, name: "Qualifying" },
  { key: 9888, name: "Race" },
];

// Drivers spread across all teams for track-width coverage
const DRIVER_NUMBERS = [1, 4, 11, 16, 44, 63, 55, 81];

// Radius for the elevation lookup in scene-normalised units (x/y in [-50,50])
// 0.8 ≈ ~145 raw coordinate units; captures nearby points without crossing
// into an adjacent parallel section of track.
const LOOKUP_RADIUS_SQ = 0.8 * 0.8;

// Gaussian smoothing: applied 3 times with this half-window on the 853-point circuit
const SMOOTH_PASSES = 4;
const SMOOTH_HALF_WINDOW = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Compute normalization bounds — exact, no percentile clip. */
function exactBounds(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const range = Math.max(maxX - minX, maxY - minY);
  return { minX, maxX, minY, maxY, range };
}

/** Normalise points to [-50, 50] using the given bounds. */
function toScene(points, bounds) {
  return points.map((p) => ({
    ...p,
    nx: ((p.x - bounds.minX) / bounds.range) * 100 - 50,
    ny: ((p.y - bounds.minY) / bounds.range) * 100 - 50,
  }));
}

/** Circular weighted moving average. */
function smoothCircular(arr, halfWindow) {
  const n = arr.length;
  return arr.map((_, i) => {
    let sum = 0, count = 0;
    for (let d = -halfWindow; d <= halfWindow; d++) {
      sum += arr[(i + d + n) % n];
      count++;
    }
    return sum / count;
  });
}

// ── Fetch data ────────────────────────────────────────────────────────────────

console.log("Fetching circuit geometry from MultiViewer…");
const circuitRes = await fetch(MULTIVIEWER_URL);
if (!circuitRes.ok) throw new Error(`MultiViewer fetch failed: ${circuitRes.status}`);
const circuit = await circuitRes.json();
console.log(`  ${circuit.x.length} circuit points`);

console.log(`\nFetching OpenF1 location data (${SESSIONS.length} sessions × ${DRIVER_NUMBERS.length} drivers)…`);
const locationPoints = [];

for (const session of SESSIONS) {
  process.stdout.write(`  [${session.name}] `);
  let sessionCount = 0;
  for (const driverNumber of DRIVER_NUMBERS) {
    const url = `${OPENF1_BASE}/location?session_key=${session.key}&driver_number=${driverNumber}`;
    const res = await fetch(url);
    if (!res.ok) { process.stdout.write(`✗`); continue; }
    const raw = await res.json();
    if (!Array.isArray(raw)) { process.stdout.write(`?`); continue; }
    // Filter: must be on-track (non-zero xy) and have a real altitude reading (z > 0)
    const valid = raw.filter((p) => (p.x !== 0 || p.y !== 0) && p.z > 0);
    locationPoints.push(...valid);
    sessionCount += valid.length;
    process.stdout.write(`·`);
  }
  console.log(` ${sessionCount.toLocaleString()} pts`);
}
console.log(`Total valid location points: ${locationPoints.length.toLocaleString()}`);

// ── Normalise both datasets into the same [-50,50] scene space ────────────────

const circBounds = exactBounds(circuit.x.map((x, i) => ({ x, y: circuit.y[i] })));
// OpenF1 data is in the same coordinate system. Reuse circuit bounds for consistency.
const normCircuit = toScene(circuit.x.map((x, i) => ({ x, y: circuit.y[i] })), circBounds);
const normLocation = toScene(locationPoints, circBounds);

// ── Build spatial grid for fast radius search ─────────────────────────────────

const GRID_SIZE = 400;
const CELL_WIDTH = 100 / GRID_SIZE;

function toCell(v) {
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((v + 50) / CELL_WIDTH)));
}

console.log("\nBuilding spatial index…");
const grid = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => []);
for (let i = 0; i < normLocation.length; i++) {
  const p = normLocation[i];
  grid[toCell(p.ny) * GRID_SIZE + toCell(p.nx)].push(i);
}

// ── Compute median elevation for each circuit centerline point ────────────────

console.log("Computing median elevation per circuit point…");

// How many grid cells correspond to LOOKUP_RADIUS_SQ
const searchCells = Math.ceil(Math.sqrt(LOOKUP_RADIUS_SQ) / CELL_WIDTH) + 1;

function radiusMedianZ(qx, qy) {
  const baseCx = toCell(qx);
  const baseCy = toCell(qy);
  const x0 = Math.max(0, baseCx - searchCells);
  const x1 = Math.min(GRID_SIZE - 1, baseCx + searchCells);
  const y0 = Math.max(0, baseCy - searchCells);
  const y1 = Math.min(GRID_SIZE - 1, baseCy + searchCells);

  const candidates = [];
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      for (const idx of grid[gy * GRID_SIZE + gx]) {
        const p = normLocation[idx];
        const dx = qx - p.nx;
        const dy = qy - p.ny;
        if (dx * dx + dy * dy <= LOOKUP_RADIUS_SQ) {
          candidates.push(p.z);
        }
      }
    }
  }

  return candidates.length > 0 ? median(candidates) : null;
}

const rawElevation = normCircuit.map((cp) => radiusMedianZ(cp.nx, cp.ny));

// For any point that had no candidates (very unlikely), fill from neighbours
for (let i = 0; i < rawElevation.length; i++) {
  if (rawElevation[i] === null) {
    // Walk outward until we find a real value
    for (let d = 1; d < rawElevation.length; d++) {
      const prev = rawElevation[(i - d + rawElevation.length) % rawElevation.length];
      const next = rawElevation[(i + d) % rawElevation.length];
      if (prev !== null || next !== null) {
        rawElevation[i] = prev ?? next;
        break;
      }
    }
  }
}

// Count how many points had ≥ N candidates (quality check)
const counts = normCircuit.map((cp) => {
  const baseCx = toCell(cp.nx);
  const baseCy = toCell(cp.ny);
  const x0 = Math.max(0, baseCx - searchCells);
  const x1 = Math.min(GRID_SIZE - 1, baseCx + searchCells);
  const y0 = Math.max(0, baseCy - searchCells);
  const y1 = Math.min(GRID_SIZE - 1, baseCy + searchCells);
  let c = 0;
  for (let gy = y0; gy <= y1; gy++)
    for (let gx = x0; gx <= x1; gx++)
      for (const idx of grid[gy * GRID_SIZE + gx]) {
        const p = normLocation[idx];
        const dx = cp.nx - p.nx, dy = cp.ny - p.ny;
        if (dx*dx + dy*dy <= LOOKUP_RADIUS_SQ) c++;
      }
  return c;
});
const minCandidates = Math.min(...counts);
const avgCandidates = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(0);
console.log(`  Candidates per point — min: ${minCandidates}, avg: ${avgCandidates}`);

const zRaw = rawElevation.map(Number);
console.log(`  Pre-smooth z range: ${Math.min(...zRaw).toFixed(1)} to ${Math.max(...zRaw).toFixed(1)}`);

// ── Multi-pass smoothing ───────────────────────────────────────────────────────

let smoothed = zRaw;
for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
  smoothed = smoothCircular(smoothed, SMOOTH_HALF_WINDOW);
}
console.log(`  Post-smooth z range: ${Math.min(...smoothed).toFixed(1)} to ${Math.max(...smoothed).toFixed(1)}`);

// Verify smoothness
const jumps = smoothed.map((v, i) => Math.abs(v - smoothed[(i + 1) % smoothed.length]));
console.log(`  Max consecutive jump: ${Math.max(...jumps).toFixed(2)}  mean: ${(jumps.reduce((a,b)=>a+b,0)/jumps.length).toFixed(3)}`);

// ── Write output ──────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, "public/data");
mkdirSync(outDir, { recursive: true });

const output = {
  ...circuit,
  z: smoothed.map((v) => Math.round(v * 10) / 10),
};

const outPath = resolve(outDir, "circuit.json");
writeFileSync(outPath, JSON.stringify(output));
console.log(`\nSaved → ${outPath}`);
console.log(`File size: ${(JSON.stringify(output).length / 1024).toFixed(1)} KB`);
