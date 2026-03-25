"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Text, Billboard } from "@react-three/drei";
import { normalizeCircuitPoints } from "@/app/lib/coordinates";
import type { CircuitData } from "@/app/hooks/useF1Data";

export default function Track({ circuit }: { circuit: CircuitData }) {
  const trackPoints = useMemo(() => {
    const raw = circuit.x.map((x, i) => ({ x, y: circuit.y[i] }));
    return normalizeCircuitPoints(raw, undefined, circuit.z);
  }, [circuit]);

  const ribbonGeometry = useMemo(() => {
    if (trackPoints.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(trackPoints, true, "catmullrom", 0.5);
    const numSamples = 800;
    const trackWidth = 3.5;
    const halfW = trackWidth / 2;

    const pts = curve.getPoints(numSamples);
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      // Perpendicular direction in the XZ ground plane
      const right = new THREE.Vector3(-dir.z, 0, dir.x);

      // 4 verts per ring:
      //   TL/TR — top surface follows track elevation
      //   BL/BR — bottom is extruded down to the flat base plane (y = 0)
      positions.push(
        curr.x - right.x * halfW, curr.y, curr.z - right.z * halfW, // TL
        curr.x + right.x * halfW, curr.y, curr.z + right.z * halfW, // TR
        curr.x - right.x * halfW, 0,      curr.z - right.z * halfW, // BL
        curr.x + right.x * halfW, 0,      curr.z + right.z * halfW  // BR
      );
    }

    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const c = i * 4;
      const nx = ((i + 1) % n) * 4;

      // Top face
      indices.push(c, c + 1, nx,  c + 1, nx + 1, nx);
      // Bottom face — flat at y=0 (winding reversed for outward normals)
      indices.push(c + 2, nx + 2, c + 3,  c + 3, nx + 2, nx + 3);
      // Left wall — connects top-left edge down to base
      indices.push(c, nx, c + 2,  nx, nx + 2, c + 2);
      // Right wall — connects top-right edge down to base
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
      // Snap label elevation to the nearest circuit point so it sits above the track
      let nearestY = 0;
      let best = Infinity;
      for (const tp of trackPoints) {
        const dx = tp.x - pos.x;
        const dz = tp.z - pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) { best = d2; nearestY = tp.y; }
      }
      return { number: c.number, position: pos, labelY: nearestY + 2 };
    });
  }, [circuit, trackPoints]);

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
          position={[corner.position.x, corner.labelY, corner.position.z]}
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
