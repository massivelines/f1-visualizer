"use client";

import { Component, useState, useEffect, type ReactNode } from "react";
import Scene from "./Scene";
import type { CircuitData } from "@/app/hooks/useF1Data";

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-[#0a0a1a] text-red-400 p-4 text-center">
          <div>
            <div className="text-lg font-bold mb-2">3D Render Error</div>
            <div className="text-sm text-zinc-500">{this.state.error}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TrackViewer({ circuit }: { circuit: CircuitData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="absolute inset-0 bg-[#0a0a1a]">
      {mounted ? (
        <SceneErrorBoundary>
          <Scene circuit={circuit} />
        </SceneErrorBoundary>
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-500">
          Loading 3D scene...
        </div>
      )}
    </div>
  );
}
