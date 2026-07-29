const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractBoxFolderUrls,
  findBoxFolderUrl,
  findProvideCopy,
  normalizeProjectName,
  parseCopyLabels,
} = require("../services/workzoneService");

test("normalizes workbook and Workzone campaign date formats", () => {
  assert.equal(
    normalizeProjectName("DKNY Email 7/26/2026"),
    normalizeProjectName("DKNY Email 7.26.26")
  );
});

test("extracts escaped Workzone Box links", () => {
  assert.deepEqual(
    extractBoxFolderUrls(
      "https:\\/\\/gcg.app.box.com\\/s\\/share_token\\/folder\\/395095299667"
    ),
    [
      "https://gcg.app.box.com/s/share_token/folder/395095299667",
    ]
  );
});

test("adds HTTPS to a scheme-less Workzone Box link", () => {
  assert.deepEqual(
    extractBoxFolderUrls("gcg.app.box.com/s/share_token"),
    ["https://gcg.app.box.com/s/share_token"]
  );
});

test("prefers the asset task when a project contains multiple Box links", () => {
  assert.equal(
    findBoxFolderUrl([
      {
        name: "General notes",
        notes: "https:\\/\\/gcg.app.box.com\\/s\\/other_share",
      },
      {
        name: "Layout Completed",
        notes: "https:\\/\\/gcg.app.box.com\\/s\\/asset_share",
      },
    ]),
    "https://gcg.app.box.com/s/asset_share"
  );
});

test("parses SL and PH from plain-text Provide Copy notes", () => {
  assert.deepEqual(
    parseCopyLabels(
      "SL: A Bags You'll Carry Everywhere\nPH: Meet your new go-to for every plan.\nBODY: Ignore this"
    ),
    {
      subjectLine: "A Bags You'll Carry Everywhere",
      preheader: "Meet your new go-to for every plan.",
    }
  );
});

test("parses SL and PH from rich-text Workzone notes", () => {
  assert.deepEqual(
    parseCopyLabels(
      "<p><strong>SL:</strong> Summer&#39;s Best</p><p><strong>PH:</strong> New arrivals are here.</p><p>CTA: Shop Now</p>"
    ),
    {
      subjectLine: "Summer's Best",
      preheader: "New arrivals are here.",
    }
  );
});

test("only reads copy from the Provide Copy task", () => {
  assert.deepEqual(
    findProvideCopy([
      {
        name: "Layout Completed",
        notes: "SL: Wrong subject PH: Wrong preheader",
      },
      {
        name: "Provide Copy",
        notes: "SL: Correct subject\nPH: Correct preheader",
      },
    ]),
    {
      subjectLine: "Correct subject",
      preheader: "Correct preheader",
    }
  );
});
