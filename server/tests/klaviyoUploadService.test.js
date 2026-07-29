const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharp = require("sharp");
const {
  MAX_UPLOAD_BYTES,
  compressForKlaviyo,
  validateUploadRequest,
} = require("../services/klaviyoUploadService");

test("validates a reference and slices from the same Box share", () => {
  const validated = validateUploadRequest({
    brandId: "dkny",
    referenceImage: {
      name: "reference.jpg",
      url: "https://gcg.app.box.com/s/token/file/1",
    },
    slices: [
      {
        name: "1_BODY.jpg",
        url: "https://gcg.app.box.com/s/token/file/2",
      },
    ],
  });

  assert.equal(validated.descriptors.length, 2);
  assert.equal(validated.descriptors[0].assetType, "reference");
});

test("rejects a PSD reference", () => {
  assert.throws(
    () =>
      validateUploadRequest({
        brandId: "dkny",
        referenceImage: {
          name: "reference.psd",
          url: "https://gcg.app.box.com/s/token/file/1",
        },
        slices: [
          {
            name: "1_BODY.jpg",
            url: "https://gcg.app.box.com/s/token/file/2",
          },
        ],
      }),
    /JPG or JPEG/
  );
});

test("rejects non-image files in the slices collection", () => {
  assert.throws(
    () =>
      validateUploadRequest({
        brandId: "dkny",
        referenceImage: {
          name: "reference.jpg",
          url: "https://gcg.app.box.com/s/token/file/1",
        },
        slices: [
          {
            name: "instructions.txt",
            url: "https://gcg.app.box.com/s/token/file/2",
          },
        ],
      }),
    /not a supported slice image/
  );
});

test("compresses an oversized image below the Klaviyo request limit", async () => {
  const width = 2400;
  const height = 2400;
  const noise = crypto.randomBytes(width * height * 3);
  const oversizedPng = await sharp(noise, {
    raw: { width, height, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

  assert.ok(oversizedPng.length > MAX_UPLOAD_BYTES);
  const prepared = await compressForKlaviyo(
    oversizedPng,
    "large.png",
    "large.png",
    "image/png"
  );

  assert.equal(prepared.compressed, true);
  assert.equal(prepared.mimeType, "image/jpeg");
  assert.ok(prepared.buffer.length <= MAX_UPLOAD_BYTES);
});
