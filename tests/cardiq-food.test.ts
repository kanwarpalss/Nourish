import assert from "node:assert/strict";
import test from "node:test";
import { isFoodLike, makeCardIqFoodImport, matchCardIqFood } from "../app/cardiq-food";

test("cardIQ food import keeps real grocery products and excludes obvious non-food purchases", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-20T10:00:00Z", items: [{ name: "Nandini GoodLife Toned Milk, 1 L", qty: 2 }, { name: "Pampers baby diapers", qty: 1 }] },
    { source: "generic", merchant_name: "Instamart", order_at: "2026-07-21T10:00:00Z", items: [{ name: "Carrot", qty: "3" }, { name: "Himalaya protein shampoo", qty: 1 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");

  assert.equal(snapshot.orderCount, 2);
  assert.deepEqual(snapshot.items.map((item) => item.name), ["Carrot", "Nandini GoodLife Toned Milk, 1 L"]);
  assert.deepEqual(matchCardIqFood("Nandini GoodLife Toned Milk"), { matchedFoodId: "nandini-goodlife-toned", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Fresh Carrot 500g"), { matchedFoodId: "carrot", matchKind: "Reference ingredient" });
  assert.equal(isFoodLike("Pampers baby diapers", "Amazon"), false);
  assert.equal(isFoodLike("Fresh Bottle Gourd", "Amazon"), true);
});

test("cardIQ import groups repeat purchases and preserves the latest order date", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-06-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 1 }] },
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 2 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");
  assert.deepEqual(snapshot.items[0], { name: "Fresh Carrot 500g", store: "Amazon", orderCount: 2, units: 3, lastOrdered: "2026-07-01", matchedFoodId: "carrot", matchKind: "Reference ingredient" });
});
