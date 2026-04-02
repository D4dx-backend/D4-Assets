import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Asset from "@/lib/models/Asset";
import Movement from "@/lib/models/Movement";

// GET /api/assets/availability?search=<name>
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  if (!search) return NextResponse.json({ success: true, data: [] });

  await connectDB();

  const assets = await Asset.find({ isActive: true, $text: { $search: search } })
    .select("name category dateOfPurchase warrantyDetails warrantyExpiryDate")
    .sort({ score: { $meta: "textScore" } })
    .limit(20)
    .lean();

  if (assets.length === 0) return NextResponse.json({ success: true, data: [] });

  const assetIds = assets.map((a) => a._id);

  // Find the latest OUT movement for each asset
  const outMovements = await Movement.find({
    asset: { $in: assetIds },
    status: "OUT",
  })
    .populate("event", "name location fromDate toDate")
    .populate("allocatedPerson", "name")
    .sort({ outDate: -1 })
    .lean();

  // Build a map: assetId -> latest OUT movement
  const outMap = new Map<string, typeof outMovements[0]>();
  for (const m of outMovements) {
    const key = m.asset.toString();
    if (!outMap.has(key)) outMap.set(key, m);
  }

  const data = assets.map((asset) => {
    const assetId = (asset._id as { toString(): string }).toString();
    const movement = outMap.get(assetId);
    if (movement) {
      const event = movement.event as unknown as {
        name: string;
        location: string;
        fromDate: string;
        toDate: string;
      };
      const person = movement.allocatedPerson as unknown as { name: string };
      return {
        _id: assetId,
        name: asset.name,
        category: asset.category,
        dateOfPurchase: asset.dateOfPurchase,
        warrantyDetails: asset.warrantyDetails,
        warrantyExpiryDate: asset.warrantyExpiryDate ?? null,
        available: false,
        movement: {
          _id: (movement._id as { toString(): string }).toString(),
          eventName: event?.name ?? "",
          eventLocation: event?.location ?? "",
          eventFromDate: event?.fromDate ?? null,
          eventToDate: event?.toDate ?? null,
          allocatedPerson: person?.name ?? "",
          outDate: movement.outDate,
          condition: movement.condition,
        },
      };
    }
    return {
      _id: assetId,
      name: asset.name,
      category: asset.category,
      dateOfPurchase: asset.dateOfPurchase,
      warrantyDetails: asset.warrantyDetails,
      warrantyExpiryDate: asset.warrantyExpiryDate ?? null,
      available: true,
      movement: null,
    };
  });

  return NextResponse.json({ success: true, data });
}
