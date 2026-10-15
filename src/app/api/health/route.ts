import { connectToDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mongoose = await connectToDatabase();
    const database = mongoose.connection.db;

    if (!database) {
      throw new Error("MongoDB connection is missing its database handle");
    }

    await database.admin().ping();

    return Response.json(
      { status: "ok", database: "connected" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed", error);

    return Response.json(
      { status: "unhealthy", database: "disconnected" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
