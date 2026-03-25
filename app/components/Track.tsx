"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Text, Billboard } from "@react-three/drei";
import { normalizeCircuitPoints } from "@/app/lib/coordinates";
import type { CircuitData } from "@/app/hooks/useF1Data";

export default function Track({ circuit }: { circuit: CircuitData }) {
  const trackPoints = useMemo(() => {
    const raw = circuit.x.map((x, i) => ({ x, y: circuit.y[i] }));
    return normalizeCircuitPoints(raw);
  }, [circuit]);

  const ribbonGeometry = useMemo(() => {
    if (trackPoints.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(trackPoints, true, "catmullrom", 0.5);
    const numSamples = 800;
    const trackWidth = 3.5;
    const thickness = 0.35;
    const halfW = trackWidth / 2;
    const halfH = thickness / 2;

    const pts = curve.getPoints(numSamples);
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      // Perpendicular direction in the XZ ground plane
      const right = new THREE.Vector3(-dir.z, 0, dir.x);

      // 4 verts per ring: top-left, top-right, bottom-left, bottom-right
      positions.push(
        curr.x - right.x * halfW, curr.y + halfH, curr.z - right.z * halfW, // TL
        curr.x + right.x * halfW, curr.y + halfH, curr.z + right.z * halfW, // TR
        curr.x - right.x * halfW, curr.y - halfH, curr.z - right.z * halfW, // BL
        curr.x + right.x * halfW, curr.y - halfH, curr.z + right.z * halfW  // BR
      );
    }

    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const c = i * 4;
      const nx = ((i + 1) % n) * 4;

      // Top face
      indices.push(c, c + 1, nx,  c + 1, nx + 1, nx);
      // Bottom face (winding reversed)
      indices.push(c + 2, nx + 2, c + 3,  c + 3, nx + 2, nx + 3);
      // Left side
      indices.push(c, nx, c + 2,  nx, nx + 2, c + 2);
      // Right side
      indices.push(c + 1, c + 3, nx + 1,  nx + 1, c + 3, nx + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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
      {ribbonGeometry && (
        <mesh geometry={ribbonGeometry}>
          <meshStandardMaterial color="white" roughness={0.5} metalness={0.05} />
        </mesh>
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
