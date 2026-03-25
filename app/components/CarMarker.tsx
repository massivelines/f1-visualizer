"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { interpolatePosition, normalizeLocationPoints, type LocationPoint } from "@/app/lib/coordinates";

interface CarMarkerProps {
  locationData: LocationPoint[];
  normalizedPoints: THREE.Vector3[];
  timestamps: number[];
  currentTimeMs: number;
  teamColor: string;
}

export default function CarMarker({
  normalizedPoints,
  timestamps,
  currentTimeMs,
  teamColor,
}: CarMarkerProps) {
  const position = useMemo(() => {
    if (normalizedPoints.length === 0) return new THREE.Vector3();
    return interpolatePosition(normalizedPoints, timestamps, currentTimeMs);
  }, [normalizedPoints, timestamps, currentTimeMs]);

  return (
    <group position={[position.x, position.y + 0.5, position.z]}>
      {/* Car body - simple sphere */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={`#${teamColor}`}
          emissive={`#${teamColor}`}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Glow effect */}
      <pointLight color={`#${teamColor}`} intensity={2} distance={5} />
    </group>
  );
}
