const OPENF1_BASE = "https://api.openf1.org/v1";

export async function GET() {
  const res = await fetch(
    `${OPENF1_BASE}/sessions?circuit_short_name=Austin&session_name=Race&year=2025`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    return Response.json(
      { error: "Failed to fetch sessions" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
