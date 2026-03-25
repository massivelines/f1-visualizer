import { type NextRequest } from "next/server";

const OPENF1_BASE = "https://api.openf1.org/v1";

export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("session_key");
  const driverNumber = request.nextUrl.searchParams.get("driver_number");

  if (!sessionKey || !driverNumber) {
    return Response.json(
      { error: "session_key and driver_number are required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${OPENF1_BASE}/location?session_key=${encodeURIComponent(sessionKey)}&driver_number=${encodeURIComponent(driverNumber)}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) {
    return Response.json(
      { error: "Failed to fetch location data" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
