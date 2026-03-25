"use client";

import type { Driver } from "@/app/hooks/useF1Data";

interface DriverPickerProps {
  drivers: Driver[];
  selectedDriver: number | undefined;
  onSelect: (driverNumber: number) => void;
  loading: boolean;
}

export default function DriverPicker({
  drivers,
  selectedDriver,
  onSelect,
  loading,
}: DriverPickerProps) {
  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Drivers
        </h2>
        <div className="text-zinc-500 text-sm">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Select Driver
      </h2>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
        {drivers.map((driver) => (
          <button
            key={driver.driver_number}
            onClick={() => onSelect(driver.driver_number)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedDriver === driver.driver_number
                ? "bg-zinc-700/80 ring-1 ring-zinc-500"
                : "hover:bg-zinc-800/60"
            }`}
          >
            <div
              className="w-1 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: `#${driver.team_colour}` }}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-100 truncate">
                {driver.full_name}
              </div>
              <div className="text-xs text-zinc-400">
                #{driver.driver_number} · {driver.team_name}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
