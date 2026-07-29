const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertMatchingBoxShare,
  parseBoxSharedUrl,
} = require("../services/boxUrlService");
const {
  isReferenceJpgName,
  isSupportedImageName,
} = require("../services/boxService");

test("accepts and canonicalizes approved Box shared links", () => {
  const parsed = parseBoxSharedUrl(
    "https://gcg.app.box.com/s/share_token/folder/395095299667?sort=name",
    "folder"
  );

  assert.equal(parsed.hostname, "gcg.app.box.com");
  assert.equal(parsed.shareToken, "share_token");
  assert.equal(parsed.kind, "folder");
  assert.equal(
    parsed.url,
    "https://gcg.app.box.com/s/share_token/folder/395095299667"
  );
});

test("accepts a Box share root as a folder link", () => {
  const parsed = parseBoxSharedUrl(
    "https://gcg.app.box.com/s/share_token",
    "folder"
  );

  assert.equal(parsed.kind, null);
  assert.equal(parsed.shareToken, "share_token");
  assert.equal(parsed.url, "https://gcg.app.box.com/s/share_token");
});

test("rejects non-Box and non-HTTPS URLs", () => {
  assert.throws(
    () => parseBoxSharedUrl("http://gcg.app.box.com/s/token/folder/1"),
    /Only HTTPS/
  );
  assert.throws(
    () => parseBoxSharedUrl("https://example.com/s/token/folder/1"),
    /approved Box domain/
  );
  assert.throws(
    () => parseBoxSharedUrl("https://gcg.app.box.com.evil.test/s/token/folder/1"),
    /approved Box domain/
  );
});

test("requires every upload asset to use the same Box share token", () => {
  assert.throws(
    () =>
      assertMatchingBoxShare([
        "https://gcg.app.box.com/s/first/file/1",
        "https://gcg.app.box.com/s/second/file/2",
      ]),
    /same shared folder/
  );
});

test("identifies reference JPGs and supported slice image names", () => {
  assert.equal(isReferenceJpgName("campaign.jpg"), true);
  assert.equal(isReferenceJpgName("campaign.jpeg"), true);
  assert.equal(isReferenceJpgName("campaign.psd"), false);
  assert.equal(isReferenceJpgName("campaign-slice.jpg"), false);
  assert.equal(isSupportedImageName("1_BODY.jpg"), true);
  assert.equal(isSupportedImageName("notes.txt"), false);
  assert.equal(isSupportedImageName("design.psd"), false);
});
