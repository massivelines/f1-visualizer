"use client";

import { useMemo } from "react";
import type { CarDataPoint } from "@/app/hooks/useF1Data";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  currentTimeMs: number;
  startTimeMs: number;
  endTimeMs: number;
  onSeek: (timeMs: number) => void;
  carData: CarDataPoint[];
  loading: boolean;
}

const SPEED_OPTIONS = [1, 2, 5, 10, 20];

export default function PlaybackControls({
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  currentTimeMs,
  startTimeMs,
  endTimeMs,
  onSeek,
  carData,
  loading,
}: PlaybackControlsProps) {
  const progress = endTimeMs > startTimeMs
    ? ((currentTimeMs - startTimeMs) / (endTimeMs - startTimeMs)) * 100
    : 0;

  const currentTelemetry = useMemo(() => {
    if (carData.length === 0) return null;
    // Find nearest car data point
    let best = carData[0];
    let bestDelta = Infinity;
    for (const d of carData) {
      const delta = Math.abs(new Date(d.date).getTime() - currentTimeMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = d;
      }
      if (new Date(d.date).getTime() > currentTimeMs + 2000) break;
    }
    return best;
  }, [carData, currentTimeMs]);

  const elapsed = useMemo(() => {
    if (startTimeMs === 0) return "0:00";
    const secs = Math.floor((currentTimeMs - startTimeMs) / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  }, [currentTimeMs, startTimeMs]);

  const total = useMemo(() => {
    if (startTimeMs === 0 || endTimeMs === 0) return "0:00";
    const secs = Math.floor((endTimeMs - startTimeMs) / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  }, [startTimeMs, endTimeMs]);

  return (
    <div className="p-4 border-t border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Playback
      </h2>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading data...</div>
      ) : (
        <>
          {/* Play/Pause + Speed */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-white"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <div className="flex gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                    playbackSpeed === s
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Scrubber */}
          <div className="mb-3">
            <input
              type="range"
              min={startTimeMs}
              max={endTimeMs || 1}
              value={currentTimeMs}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-1 appearance-none bg-zinc-700 rounded-full cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1 font-mono">
              <span>{elapsed}</span>
              <span>{total}</span>
            </div>
          </div>

          {/* Telemetry readout */}
          {currentTelemetry && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Speed</div>
                <div className="text-lg font-mono text-zinc-100">
                  {currentTelemetry.speed}
                </div>
                <div className="text-xs text-zinc-500">km/h</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Gear</div>
                <div className="text-lg font-mono text-zinc-100">
                  {currentTelemetry.n_gear}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Throttle</div>
                <div className="text-lg font-mono text-zinc-100">
                  {currentTelemetry.throttle}%
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
