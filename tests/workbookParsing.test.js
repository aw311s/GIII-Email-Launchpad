import test from "node:test";
import assert from "node:assert/strict";
import { parseCampaigns } from "../src/features/workbook/parseCampaigns.js";

test("parses shifted campaign labels and a link without an Image row", () => {
  const rows = [
    ["", "", "SEND DATE", "7/23/2026"],
    ["", "", "KEY MESSAGE", "Summer Grid"],
    ["", "", "MESSAGE TYPE", "Ecomm"],
    ["", "", "PRODUCT STORY", "Grid story"],
    ["", "", "CTA", "Shop Now"],
    ["", "", "LINK", "www.dkny.com/summer"],
    [
      "",
      "",
      "WORKZONE NOTES",
      "Subject Line: Summer starts now https://gcg.app.box.com/s/share123/folder/123",
    ],
  ];

  const campaigns = parseCampaigns(rows);

  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].workbook.wzDate, "7/23/2026");
  assert.equal(campaigns[0].workbook.items.length, 1);
  assert.deepEqual(campaigns[0].workbook.items[0], {
    image: "",
    product: "Grid story",
    cta: "Shop Now",
    link: "https://www.dkny.com/summer",
  });
  assert.equal(
    campaigns[0].box.folderUrl,
    "https://gcg.app.box.com/s/share123/folder/123"
  );
});

test("starts a new item when a second product row appears", () => {
  const rows = [
    ["SEND DATE", "7/24/2026"],
    ["PRODUCT", "First"],
    ["LINK", "https://example.com/first"],
    ["PRODUCT", "Second"],
    ["LINK", "https://example.com/second"],
  ];

  const [campaign] = parseCampaigns(rows);
  assert.equal(campaign.workbook.items.length, 2);
  assert.equal(campaign.workbook.items[0].link, "https://example.com/first");
  assert.equal(campaign.workbook.items[1].link, "https://example.com/second");
});
