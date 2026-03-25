"use client";

import { useCircuit } from "@/app/hooks/useF1Data";
import TrackViewer from "@/app/components/TrackViewer";

export default function Home() {
  const { circuit, loading, error } = useCircuit();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-100 mb-2">F1 COTA 3D</div>
          <div className="text-zinc-400">Loading circuit...</div>
        </div>
      </div>
    );
  }

  if (error || !circuit) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 mb-2">Error</div>
          <div className="text-zinc-400">{error ?? "No circuit data"}</div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen relative">
      <TrackViewer circuit={circuit} />
    </main>
  );
}
