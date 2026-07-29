import test from "node:test";
import assert from "node:assert/strict";
import { brands } from "../src/data/brands.js";

test("uses the actual Workzone project prefixes for each brand", () => {
  const brandMap = new Map(
    brands.map((brand) => [brand.id, brand.workzone])
  );

  assert.equal(brandMap.get("dkny").projectPrefix, "DKNY Email");
  assert.equal(brandMap.get("karl-lagerfeld").projectPrefix, "KLP Email");
  assert.equal(brandMap.get("donna-karan").projectPrefix, "DK Email");
});
