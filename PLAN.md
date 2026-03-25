# Plan: F1 COTA 3D Track Visualizer

## TL;DR
Build a 3D visualization of the Circuit of the Americas (COTA) using React Three Fiber, showing real elevation data and animated driver replays from the 2025 US Grand Prix. Data sourced from OpenF1 API (car positions at 3.7Hz, telemetry) and MultiViewer circuit API (track geometry). Next.js API routes proxy all external requests.

## Architecture Overview
- **3D Rendering**: React Three Fiber (Three.js) with `'use client'` directive, loaded via `next/dynamic` with `{ ssr: false }`
- **Data Layer**: Next.js API route handlers in `app/api/` proxying OpenF1 + MultiViewer APIs
- **State**: React state + refs for playback controls and driver selection
- **Styling**: Tailwind CSS (already configured)

## Key Data Sources
- **Track geometry**: `https://api.multiviewer.app/api/v1/circuits/9/2025` → x,y arrays (800+ points defining track centerline), corner metadata
- **Car positions**: `GET /v1/location?session_key=SESSION_KEY&driver_number=N` → x,y,z at 3.7Hz
- **Car telemetry**: `GET /v1/car_data?session_key=SESSION_KEY&driver_number=N` → speed, throttle, brake, gear, RPM, DRS
- **Drivers list**: `GET /v1/drivers?session_key=SESSION_KEY` → names, numbers, team colors
- **Sessions**: `GET /v1/sessions?country_name=United%20States&session_name=Race&year=2025` → session_key for the race
- **Meeting**: meeting_key=1271 (2025 US GP, COTA, Oct 17-19 2025)

## Coordinate System Challenge
- MultiViewer track geometry uses one coordinate system (x,y with values ranging ~-4000 to 6000)
- OpenF1 location data uses a separate coordinate system (x,y,z)
- Both should represent the same track shape but at different scales/offsets
- **Approach**: Use OpenF1 location data ONLY for car positions; use MultiViewer data for track outline. Normalize both to the same coordinate space by finding the bounding box of each and mapping to a common range. The z-values from OpenF1 location data provide elevation.

---

## Steps

### Phase 1: Data Infrastructure
1. **Create API route for sessions** — `app/api/f1/sessions/route.ts`
   - Proxy `GET https://api.openf1.org/v1/sessions?country_name=United%20States&session_name=Race&year=2025`
   - Cache the response (session keys don't change)
   - Returns session_key needed by all other endpoints

2. **Create API route for drivers** — `app/api/f1/drivers/route.ts`
   - Proxy `GET https://api.openf1.org/v1/drivers?session_key=SESSION_KEY`
   - Returns driver list with numbers, names, team colors, headshots

3. **Create API route for location data** — `app/api/f1/location/route.ts`
   - Proxy `GET https://api.openf1.org/v1/location?session_key=SESSION_KEY&driver_number=N`
   - This is the largest dataset (~3.7 samples/sec × ~5400 sec race ≈ ~20K points per driver)
   - Consider pagination or time-range filtering to manage payload size

4. **Create API route for car telemetry** — `app/api/f1/car-data/route.ts`
   - Proxy `GET https://api.openf1.org/v1/car_data?session_key=SESSION_KEY&driver_number=N`
   - Speed data used for path color-coding

5. **Create API route for circuit data** — `app/api/f1/circuit/route.ts`
   - Proxy `GET https://api.multiviewer.app/api/v1/circuits/9/2025`
   - Returns track outline coordinates, corner positions, sector markers

### Phase 2: Track 3D Geometry (*depends on step 5*)
6. **Create track mesh builder** — `app/components/Track.tsx` (client component)
   - Convert MultiViewer x,y coordinate arrays into a Three.js CatmullRomCurve3
   - Assign elevation: either flat initially, or interpolate from OpenF1 z-data
   - Generate a TubeGeometry or custom extruded ribbon (e.g., 15m width) from the curve
   - Apply asphalt-like material (dark gray MeshStandardMaterial)
   - Add corner number labels as Billboard text sprites
   - Add track boundary lines (white edge lines)

7. **Create 3D scene wrapper** — `app/components/Scene.tsx` (client component)
   - R3F `<Canvas>` with OrbitControls for camera
   - Ambient + directional lighting
   - Ground plane under the track
   - Optional grid helper for orientation
   - Sky/environment for aesthetics

8. **Dynamic import wrapper** — `app/components/TrackViewer.tsx`
   - Use `next/dynamic(() => import('./Scene'), { ssr: false })` to prevent SSR

### Phase 3: Driver Selection UI (*parallel with Phase 2*)
9. **Create driver picker component** — `app/components/DriverPicker.tsx`
   - Fetch drivers from API route on mount
   - Dropdown/grid showing driver name, number, team color swatch
   - On selection, trigger location + telemetry data fetch

10. **Create data fetching hooks** — `app/hooks/useF1Data.ts`
    - `useSession()` — fetch and cache session_key
    - `useDrivers(sessionKey)` — fetch driver list
    - `useLocation(sessionKey, driverNumber)` — fetch position data
    - `useCarData(sessionKey, driverNumber)` — fetch telemetry

### Phase 4: Animated Replay (*depends on Phase 2 + Phase 3*)
11. **Create car marker component** — `app/components/CarMarker.tsx` (client component)
    - 3D sphere or simple car shape on the track
    - Colored with team color
    - Positioned by interpolating location data based on current playback time

12. **Create telemetry trail** — `app/components/TelemetryTrail.tsx` (client component)
    - Line geometry following the car's path
    - Vertex colors mapped from speed data (blue=slow → red=fast gradient)
    - Trail grows as car advances through playback

13. **Create playback controls** — `app/components/PlaybackControls.tsx`
    - Play/Pause button
    - Speed multiplier (1x, 2x, 5x, 10x, 20x)
    - Scrubber/timeline bar showing race progress
    - Current lap indicator
    - Current speed/gear/throttle readout

### Phase 5: Integration (*depends on all above*)
14. **Wire up the main page** — `app/page.tsx`
    - Replace boilerplate with app layout
    - Sidebar: DriverPicker + PlaybackControls
    - Main area: TrackViewer (3D canvas fills remaining space)
    - Header with app title

15. **Coordinate normalization utility** — `app/lib/coordinates.ts`
    - Function to normalize MultiViewer coords and OpenF1 coords to the same 3D space
    - Map car position timestamps to interpolated 3D positions on the track
    - Handle the different sampling rates between location and car_data

16. **Update global styles** — `app/globals.css`
    - Dark theme (suits track visualization)
    - Layout utilities for sidebar + canvas split

---

## Relevant Files
- `app/page.tsx` — Replace boilerplate with main app layout (sidebar + 3D canvas)
- `app/globals.css` — Dark theme styling for visualization app
- `app/layout.tsx` — Update metadata (title, description)
- `app/api/f1/sessions/route.ts` — NEW: Proxy OpenF1 sessions endpoint
- `app/api/f1/drivers/route.ts` — NEW: Proxy OpenF1 drivers endpoint
- `app/api/f1/location/route.ts` — NEW: Proxy OpenF1 location endpoint
- `app/api/f1/car-data/route.ts` — NEW: Proxy OpenF1 car_data endpoint
- `app/api/f1/circuit/route.ts` — NEW: Proxy MultiViewer circuit endpoint
- `app/components/Scene.tsx` — NEW: R3F Canvas, lights, camera, controls
- `app/components/Track.tsx` — NEW: 3D track mesh from circuit coordinates
- `app/components/TrackViewer.tsx` — NEW: Dynamic import wrapper (ssr: false)
- `app/components/CarMarker.tsx` — NEW: Animated driver car on track
- `app/components/TelemetryTrail.tsx` — NEW: Speed-colored path trail
- `app/components/DriverPicker.tsx` — NEW: Driver selection UI
- `app/components/PlaybackControls.tsx` — NEW: Play/pause, speed, scrubber
- `app/hooks/useF1Data.ts` — NEW: Data fetching hooks
- `app/lib/coordinates.ts` — NEW: Coordinate normalization utilities

## NPM Dependencies
- `three` — 3D rendering engine ✅ installed
- `@react-three/fiber` — React renderer for Three.js ✅ installed
- `@react-three/drei` — Useful R3F helpers (OrbitControls, Billboard, Line, Text, etc.) ✅ installed
- `@types/three` — TypeScript types ✅ installed

## Verification
1. `pnpm dev` — App loads without hydration errors or SSR crashes from Three.js
2. Track renders as a 3D ribbon with visible elevation changes (COTA Turn 1 hill should be prominent)
3. Orbit controls work (rotate, zoom, pan the camera around the track)
4. Driver dropdown populates with all 2025 COTA race drivers from OpenF1
5. Selecting a driver loads their position data and shows an animated car marker
6. Play/pause and speed controls work; car moves along the correct track path
7. Telemetry trail appears behind the car with speed-based color gradient
8. No CORS errors (all external API calls go through Next.js API routes)
9. `pnpm build` succeeds with no type errors

## Decisions
- **Single driver only** — no multi-driver comparison (per user preference)
- **Race session only** — no practice/qualifying/sprint sessions
- **Real elevation from OpenF1 z-coordinates** — not exaggerated
- **Animated replay** — car moves around track with playback controls (not static path)
- **Telemetry color coding** — speed gradient on trail behind car
- **API proxy pattern** — all external requests go through Next.js route handlers to avoid CORS

## Further Considerations
1. **Data volume**: Location data for a full race (~20K points per driver) may be large. We can fetch in chunks by time range, or fetch all at once and store in memory. Recommendation: fetch all at once with loading indicator — 20K points of {x,y,z,date} is ~2-3MB, manageable.
2. **Coordinate alignment**: The MultiViewer and OpenF1 coordinate systems may not align perfectly. We'll need to test with real data and potentially apply a rotation/scale/offset transform. This is the highest-risk technical challenge.
3. **Elevation mapping**: OpenF1 z-coordinates on the location endpoint provide elevation, but the MultiViewer track outline doesn't include elevation. We can either: (A) use only OpenF1 data for the track shape + elevation, or (B) use MultiViewer for the flat track and overlay OpenF1 z-data for elevation. Recommendation: Option A — build the track curve directly from a single lap of OpenF1 location data, which includes x,y,z. Use MultiViewer data only for corner labels and sector markers.
