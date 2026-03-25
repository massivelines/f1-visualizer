import { type NextRequest } from "next/server";

const OPENF1_BASE = "https://api.openf1.org/v1";

export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return Response.json(
      { error: "session_key is required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${OPENF1_BASE}/drivers?session_key=${encodeURIComponent(sessionKey)}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    return Response.json(
      { error: "Failed to fetch drivers" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
