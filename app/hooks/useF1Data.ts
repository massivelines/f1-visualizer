"use client";

import { useReducer, useEffect } from "react";

export interface Session {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  location: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

export interface Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url: string;
  session_key: number;
}

export interface LocationPoint {
  x: number;
  y: number;
  z: number;
  date: string;
  driver_number: number;
  session_key: number;
}

export interface CarDataPoint {
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  rpm: number;
  drs: number;
  date: string;
  driver_number: number;
  session_key: number;
}

// Generic fetch state reducer to avoid synchronous setState in effects
type FetchState<T> = { data: T; loading: boolean; error: string | null };
type FetchAction<T> =
  | { type: "start" }
  | { type: "success"; data: T }
  | { type: "error"; error: string };

function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { data: action.data, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.error };
  }
}

export function useSession() {
  const [state, dispatch] = useReducer(fetchReducer<Session | null>, {
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/f1/sessions", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sessions");
        return res.json();
      })
      .then((data: Session[]) => {
        if (data.length > 0) dispatch({ type: "success", data: data[0] });
        else dispatch({ type: "error", error: "No session found" });
      })
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "error", error: e.message });
      });
    return () => controller.abort();
  }, []);

  return { session: state.data, loading: state.loading, error: state.error };
}

export function useDrivers(sessionKey: number | undefined) {
  const [state, dispatch] = useReducer(fetchReducer<Driver[]>, {
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!sessionKey) return;
    dispatch({ type: "start" });
    const controller = new AbortController();
    fetch(`/api/f1/drivers?session_key=${sessionKey}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch drivers");
        return res.json();
      })
      .then((data: Driver[]) => {
        const seen = new Map<number, Driver>();
        for (const d of data) {
          seen.set(d.driver_number, d);
        }
        dispatch({
          type: "success",
          data: Array.from(seen.values()).sort((a, b) => a.driver_number - b.driver_number),
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "error", error: e.message });
      });
    return () => controller.abort();
  }, [sessionKey]);

  return { drivers: state.data, loading: state.loading, error: state.error };
}

export function useLocation(sessionKey: number | undefined, driverNumber: number | undefined) {
  const [state, dispatch] = useReducer(fetchReducer<LocationPoint[]>, {
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!sessionKey || !driverNumber) return;
    dispatch({ type: "start" });
    const controller = new AbortController();
    fetch(`/api/f1/location?session_key=${sessionKey}&driver_number=${driverNumber}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch location");
        return res.json();
      })
      .then((d: LocationPoint[]) => dispatch({ type: "success", data: d }))
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "error", error: e.message });
      });
    return () => controller.abort();
  }, [sessionKey, driverNumber]);

  return { data: state.data, loading: state.loading, error: state.error };
}

export function useCarData(sessionKey: number | undefined, driverNumber: number | undefined) {
  const [state, dispatch] = useReducer(fetchReducer<CarDataPoint[]>, {
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!sessionKey || !driverNumber) return;
    dispatch({ type: "start" });
    const controller = new AbortController();
    fetch(`/api/f1/car-data?session_key=${sessionKey}&driver_number=${driverNumber}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch car data");
        return res.json();
      })
      .then((d: CarDataPoint[]) => dispatch({ type: "success", data: d }))
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "error", error: e.message });
      });
    return () => controller.abort();
  }, [sessionKey, driverNumber]);

  return { data: state.data, loading: state.loading, error: state.error };
}

export interface CircuitData {
  x: number[];
  y: number[];
  corners: { number: number; angle: number; length: number; trackPosition: { x: number; y: number } }[];
  marshalLights: { trackPosition: { x: number; y: number } }[];
  marshalSectors: { trackPosition: { x: number; y: number } }[];
  rotation: number;
}

export function useCircuit() {
  const [state, dispatch] = useReducer(fetchReducer<CircuitData | null>, {
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/f1/circuit", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch circuit");
        return res.json();
      })
      .then((data: CircuitData) => dispatch({ type: "success", data }))
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "error", error: e.message });
      });
    return () => controller.abort();
  }, []);

  return { circuit: state.data, loading: state.loading, error: state.error };
}
