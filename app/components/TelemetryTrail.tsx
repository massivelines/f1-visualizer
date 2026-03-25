"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { speedToColor } from "@/app/lib/coordinates";
import type { CarDataPoint } from "@/app/hooks/useF1Data";

interface TelemetryTrailProps {
  normalizedPoints: THREE.Vector3[];
  timestamps: number[];
  carData: CarDataPoint[];
  currentTimeMs: number;
}

export default function TelemetryTrail({
  normalizedPoints,
  timestamps,
  carData,
  currentTimeMs,
}: TelemetryTrailProps) {
  // Pre-compute the full trail once when data changes (not per-frame)
  const fullTrail = useMemo(() => {
    if (normalizedPoints.length === 0 || carData.length === 0) {
      return { points: [] as [number, number, number][], colors: [] as [number, number, number][], timestamps: timestamps };
    }

    const maxSpeed = Math.max(...carData.map((d) => d.speed), 1);

    // Build sorted speed array for binary search
    const speedEntries = carData.map((d) => ({ t: new Date(d.date).getTime(), speed: d.speed }));
    speedEntries.sort((a, b) => a.t - b.t);

    const pts: [number, number, number][] = [];
    const cols: [number, number, number][] = [];

    for (let i = 0; i < normalizedPoints.length; i++) {
      const p = normalizedPoints[i];
      pts.push([p.x, p.y + 0.15, p.z]);

      // Binary search for nearest speed
      const ts = timestamps[i];
      let lo = 0, hi = speedEntries.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (speedEntries[mid].t < ts) lo = mid + 1;
        else hi = mid;
      }
      let nearestSpeed = speedEntries[lo]?.speed ?? 0;
      if (lo > 0 && Math.abs(speedEntries[lo - 1].t - ts) < Math.abs(speedEntries[lo].t - ts)) {
        nearestSpeed = speedEntries[lo - 1].speed;
      }

      const color = speedToColor(nearestSpeed, maxSpeed);
      cols.push([color.r, color.g, color.b]);
    }

    return { points: pts, colors: cols, timestamps };
  }, [normalizedPoints, timestamps, carData]);

  // Slice the pre-computed trail to the current time
  const { trailPoints, trailColors } = useMemo(() => {
    if (fullTrail.points.length === 0) return { trailPoints: [], trailColors: [] };

    // Binary search for cutoff index
    const ts = fullTrail.timestamps;
    let lo = 0, hi = ts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= currentTimeMs) lo = mid + 1;
      else hi = mid;
    }

    return {
      trailPoints: fullTrail.points.slice(0, lo),
      trailColors: fullTrail.colors.slice(0, lo),
    };
  }, [fullTrail, currentTimeMs]);

  if (trailPoints.length < 2) return null;

  return (
    <Line
      points={trailPoints}
      vertexColors={trailColors}
      lineWidth={3}
    />
  );
}
