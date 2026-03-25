"use client";

import { useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import Track from "./Track";
import type { CircuitData } from "@/app/hooks/useF1Data";

export default function Scene({ circuit }: { circuit: CircuitData }) {
  const handleCreated = useCallback((state: RootState) => {
    state.gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 100, 80], fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      frameloop="demand"
      style={{ width: "100%", height: "100%", background: "#0a0a1a" }}
      onCreated={handleCreated}
    >
      <color attach="background" args={["#0a0a1a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 30]} intensity={1.2} />
      <hemisphereLight args={["#1a1a3e", "#0a0a0a", 0.5]} />

      <Track circuit={circuit} />

      <Grid
        args={[200, 200]}
        position={[0, -0.5, 0]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#1a1a2e"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#16213e"
        fadeDistance={150}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={300}
      />
    </Canvas>
  );
}
