import { readFileSync } from "fs";
import { resolve } from "path";

export async function GET() {
  const filePath = resolve(process.cwd(), "public/data/circuit.json");
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  return Response.json(data);
}
