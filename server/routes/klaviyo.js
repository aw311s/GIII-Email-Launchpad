const express = require("express");
const fs = require("fs/promises");
const { chromium } = require("playwright");
const sharp = require("sharp");


const router = express.Router();


const BRAND_KEY_ENV = {
  dkny: "KLAVIYO_API_KEY_DKNY",
  "karl-lagerfeld": "KLAVIYO_API_KEY_KARL",
  "donna-karan": "KLAVIYO_API_KEY_DONNA",
};


const KLAVIYO_REVISION = process.env.KLAVIYO_REVISION || "2026-07-15";
const MAX_UPLOAD_BYTES = 4.8 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 2;
const MIN_UPLOAD_INTERVAL_MS = 350;
const MIN_BOX_DOWNLOAD_INTERVAL_MS = 750;
const BOX_DOWNLOAD_ATTEMPTS = 2;
const BOX_DOWNLOAD_CONTROL_TIMEOUT_MS = 20000;


function getKlaviyoKey(brandId) {
  const envName = BRAND_KEY_ENV[brandId];
  if (!envName) return null;
  return process.env[envName] || null;
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function createStartGate(minIntervalMs) {
  let lastStart = 0;
  let queue = Promise.resolve();

  return function waitForUploadSlot() {
    const slot = queue.then(async () => {
      const delay = Math.max(
        0,
        minIntervalMs - (Date.now() - lastStart)
      );

      if (delay) await sleep(delay);
      lastStart = Date.now();
    });

    queue = slot.catch(() => {});
    return slot;
  };
}


async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}


function normalizeAssetName(asset, index, fallbackPrefix = "asset") {
  return (
    asset?.name ||
    asset?.fileName ||
    asset?.filename ||
    asset?.title ||
    `${fallbackPrefix}-${index + 1}`
  ).replace(/\s+/g, "_");
}


function getAssetPageUrl(asset) {
  return asset?.url || asset?.pageUrl || asset?.href || "";
}


function inferMimeTypeFromName(name) {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "image/jpeg";
}


async function downloadBoxFileAsBlob(
  context,
  waitForBoxDownloadSlot,
  filePageUrl,
  fallbackName
) {
  let lastDownloadError;

  for (let attempt = 1; attempt <= BOX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    const page = await context.newPage();

    try {
      await page.goto(filePageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      const downloadButton = page
        .locator(
          [
            'button[data-testid="large-download-button-with-text"][data-resin-target="download"]',
            'button[data-resin-target="download"][aria-label="Download"]',
            'button[data-testid="download-preview"]',
          ].join(", ")
        )
        .filter({ visible: true })
        .first();

      await downloadButton.waitFor({
        state: "visible",
        timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
      });
      await waitForBoxDownloadSlot();

      const downloadPromise = page.waitForEvent("download", {
        timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
      });
      await downloadButton.click({ timeout: 10000 });
      const download = await downloadPromise;

      const tempPath = await download.path();
      if (!tempPath) {
        throw new Error(`Box download path unavailable for ${fallbackName}`);
      }

      let buffer = await fs.readFile(tempPath);
      let fileName = download.suggestedFilename() || fallbackName;
      let mimeType = inferMimeTypeFromName(fileName);


      if (buffer.length > MAX_UPLOAD_BYTES) {
        try {
          const source = buffer;
          const attempts = [
            { size: 1600, quality: 82 },
            { size: 1400, quality: 76 },
            { size: 1200, quality: 70 },
          ];

          for (const { size, quality } of attempts) {
            buffer = await sharp(source, { failOnError: false })
              .rotate()
              .resize({
                width: size,
                height: size,
                fit: "inside",
                withoutEnlargement: true,
              })
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();

            if (buffer.length <= MAX_UPLOAD_BYTES) break;
          }

          if (buffer.length > MAX_UPLOAD_BYTES) {
            throw new Error("compressed image is still larger than 4.8 MB");
          }

          fileName = fileName.replace(/\.(png|gif|webp|jpe?g|bmp|tiff|psd)$/i, "") + ".jpg";
          mimeType = "image/jpeg";
        } catch (error) {
          throw new Error(
            `Could not compress ${fallbackName} under Klaviyo's size limit: ${error.message}`
          );
        }
      }


      return {
        blob: new Blob([buffer], { type: mimeType }),
        fileName,
        mimeType,
        byteLength: buffer.length,
      };
    } catch (error) {
      lastDownloadError = error;
    } finally {
      await page.close();
    }
  }

  throw new Error(
    `Could not trigger a Box download for ${fallbackName}: ${lastDownloadError?.message || "unknown Box error"}`
  );
}


async function uploadOneAssetToKlaviyo({
  apiKey,
  context,
  waitForBoxDownloadSlot,
  waitForUploadSlot,
  asset,
  index,
  fallbackPrefix,
}) {
  const assetPageUrl = getAssetPageUrl(asset);
  const assetName = normalizeAssetName(asset, index, fallbackPrefix);


  if (!assetPageUrl) {
    throw new Error(`Missing asset URL for ${assetName}`);
  }


  const { blob, fileName, mimeType } = await downloadBoxFileAsBlob(
    context,
    waitForBoxDownloadSlot,
    assetPageUrl,
    assetName
  );


  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("name", assetName);

  await waitForUploadSlot();

  const response = await fetch("https://a.klaviyo.com/api/image-upload", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      accept: "application/vnd.api+json",
      revision: KLAVIYO_REVISION,
    },
    body: formData,
  });


  const text = await response.text();


  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { rawText: text };
  }


  if (!response.ok) {
    const message =
      parsed?.errors?.[0]?.detail ||
      parsed?.errors?.[0]?.title ||
      text ||
      `Klaviyo upload failed for ${assetName}`;
    throw new Error(message);
  }


  return {
    assetType: fallbackPrefix,
    assetName,
    assetPageUrl,
    mimeType,
    klaviyoImageId: parsed?.data?.id || null,
    klaviyoImageUrl: parsed?.data?.attributes?.image_url || null,
    response: parsed,
  };
}


router.get("/status", (req, res) => {
  res.json({
    ok: true,
    brandKeysPresent: {
      dkny: Boolean(process.env.KLAVIYO_API_KEY_DKNY),
      "karl-lagerfeld": Boolean(process.env.KLAVIYO_API_KEY_KARL),
      "donna-karan": Boolean(process.env.KLAVIYO_API_KEY_DONNA),
    },
    revision: KLAVIYO_REVISION,
  });
});


router.post("/upload-slices", async (req, res) => {
  let browser;

  try {
    const { brandId, referenceImage, slices } = req.body || {};


    if (!brandId) {
      return res.status(400).json({ ok: false, message: "brandId is required" });
    }


    if (!Array.isArray(slices)) {
      return res.status(400).json({ ok: false, message: "slices must be an array" });
    }


    const apiKey = getKlaviyoKey(brandId);


    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        message: `No Klaviyo key configured for brandId "${brandId}"`,
      });
    }


    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const waitForBoxDownloadSlot = createStartGate(
      MIN_BOX_DOWNLOAD_INTERVAL_MS
    );
    const waitForUploadSlot = createStartGate(MIN_UPLOAD_INTERVAL_MS);
    const referenceImageUrl = getAssetPageUrl(referenceImage);
    const referenceAsset = referenceImageUrl
      ? { asset: referenceImage, assetType: "reference", assetIndex: 0 }
      : null;
    const sliceAssets = slices.map((asset, index) => ({
      asset,
      assetType: "slice",
      assetIndex: index,
    }));
    const uploadAsset = async ({ asset, assetType, assetIndex }) => {
      try {
        const uploaded = await uploadOneAssetToKlaviyo({
          apiKey,
          context,
          waitForBoxDownloadSlot,
          waitForUploadSlot,
          asset,
          index: assetIndex,
          fallbackPrefix: assetType,
        });

        return { ok: true, uploaded, assetType };
      } catch (error) {
        return {
          ok: false,
          assetType,
          assetName: normalizeAssetName(asset, assetIndex, assetType),
          error: error.message,
        };
      }
    };
    const referenceResult = referenceAsset
      ? await uploadAsset(referenceAsset)
      : null;
    const sliceResults = await mapWithConcurrency(
      sliceAssets,
      UPLOAD_CONCURRENCY,
      uploadAsset
    );
    const results = [
      ...(referenceResult ? [referenceResult] : []),
      ...sliceResults,
    ];

    const uploadedImages = results
      .filter((result) => result.ok)
      .map((result) => result.uploaded);
    const failedReferenceResult = results.find(
      (result) => !result.ok && result.assetType === "reference"
    );
    const failedReference = referenceImage && !referenceImageUrl
      ? {
          referenceName: normalizeAssetName(referenceImage, 0, "reference"),
          error: "Missing reference JPG Box file page URL",
        }
      : failedReferenceResult
        ? {
          referenceName: failedReferenceResult.assetName,
          error: failedReferenceResult.error,
        }
        : null;
    const failedSlices = results
      .filter((result) => !result.ok && result.assetType === "slice")
      .map((result) => ({
        sliceName: result.assetName,
        error: result.error,
      }));


    return res.json({
      ok: !failedReference && failedSlices.length === 0,
      uploadedImages,
      failedReference,
      failedSlices,
    });
  } catch (error) {
    console.error("Klaviyo upload error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Failed to upload assets to Klaviyo",
    });
  } finally {
    await browser?.close().catch(() => {});
  }
});


module.exports = router;
