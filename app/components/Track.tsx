"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line, Text, Billboard } from "@react-three/drei";
import { normalizeCircuitPoints } from "@/app/lib/coordinates";
import type { CircuitData } from "@/app/hooks/useF1Data";

export default function Track({ circuit }: { circuit: CircuitData }) {
  const trackPoints = useMemo(() => {
    const raw = circuit.x.map((x, i) => ({ x, y: circuit.y[i] }));
    return normalizeCircuitPoints(raw);
  }, [circuit]);

  const tubeArgs = useMemo(() => {
    if (trackPoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(trackPoints, true, "catmullrom", 0.5);
    return [curve, 400, 1.5, 8, true] as const;
  }, [trackPoints]);

  const linePoints = useMemo(() => {
    if (trackPoints.length < 2) return [];
    return [...trackPoints, trackPoints[0]].map(
      (p) => [p.x, p.y, p.z] as [number, number, number]
    );
  }, [trackPoints]);

  const cornerLabels = useMemo(() => {
    const bbox = {
      minX: Math.min(...circuit.x),
      maxX: Math.max(...circuit.x),
      minY: Math.min(...circuit.y),
      maxY: Math.max(...circuit.y),
      minZ: 0,
      maxZ: 0,
    };
    return (circuit.corners ?? []).map((c) => {
      const [pos] = normalizeCircuitPoints(
        [{ x: c.trackPosition.x, y: c.trackPosition.y }],
        bbox
      );
      return { number: c.number, position: pos };
    });
  }, [circuit]);

  return (
    <group>
      {tubeArgs && (
        <mesh>
          <tubeGeometry args={[...tubeArgs]} />
          <meshStandardMaterial color="#333333" roughness={0.8} metalness={0.1} />
        </mesh>
      )}

      {linePoints.length > 0 && (
        <Line points={linePoints} color="white" lineWidth={1} opacity={0.3} transparent />
      )}

      {cornerLabels.map((corner) => (
        <Billboard
          key={corner.number}
          position={[corner.position.x, 2, corner.position.z]}
          follow
        >
          <Text
            fontSize={1.5}
            color="#ff6600"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            {`T${corner.number}`}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}
