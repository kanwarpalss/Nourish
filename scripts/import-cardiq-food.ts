import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { makeCardIqFoodImport, type CardIqOrder } from "../app/cardiq-food";

const cardIqDir = process.env.CARDIQ_DIR ?? resolve(process.cwd(), "../cardIQ");
const outputPath = process.env.CARDIQ_FOOD_OUTPUT ?? resolve(process.cwd(), "public/cardiq-food-import.json");
const windowStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

function readEnv(path: string) {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

async function main() {
  const env = readEnv(join(cardIqDir, ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("cardIQ is missing the local Supabase URL or service-role key.");

  const settings = await fetch(`${url}/rest/v1/user_settings?select=user_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!settings.ok) throw new Error(`Couldn't read the cardIQ account: ${settings.status}`);
  const userId = (await settings.json() as Array<{ user_id?: string }>)[0]?.user_id;
  if (!userId) throw new Error("Couldn't find the cardIQ account owner.");

  const params = new URLSearchParams({
    select: "source,merchant_name,order_at,items",
    user_id: `eq.${userId}`,
    kind: "eq.order",
    duplicate_of: "is.null",
    order_at: `gte.${windowStart}`,
    order: "order_at.desc",
  });
  const response = await fetch(`${url}/rest/v1/orders?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-999" } });
  if (!response.ok) throw new Error(`Couldn't read cardIQ orders: ${response.status}`);
  const orders = await response.json() as CardIqOrder[];
  const snapshot = makeCardIqFoodImport(orders, new Date().toISOString(), windowStart.slice(0, 10));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const ready = snapshot.items.filter((item) => item.matchedFoodId).length;
  console.log(`Saved ${snapshot.items.length} food products from ${snapshot.orderCount} cardIQ orders; ${ready} have a ready Nourish match.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
