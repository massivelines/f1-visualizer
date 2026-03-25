const MULTIVIEWER_URL = "https://api.multiviewer.app/api/v1/circuits/9/2025";

export async function GET() {
  const res = await fetch(MULTIVIEWER_URL, { next: { revalidate: 86400 } });

  if (!res.ok) {
    return Response.json(
      { error: "Failed to fetch circuit data" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
