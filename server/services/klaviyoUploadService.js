const fs = require("fs/promises");
const { chromium } = require("playwright");
const sharp = require("sharp");
const {
  assertMatchingBoxShare,
} = require("./boxUrlService");

const BRAND_KEY_ENV = {
  dkny: "KLAVIYO_API_KEY_DKNY",
  "karl-lagerfeld": "KLAVIYO_API_KEY_KARL",
  "donna-karan": "KLAVIYO_API_KEY_DONNA",
};

const KLAVIYO_REVISION = process.env.KLAVIYO_REVISION || "2026-07-15";
const MAX_UPLOAD_BYTES = 4.8 * 1024 * 1024;
const MIN_UPLOAD_INTERVAL_MS = 350;
const MIN_BOX_DOWNLOAD_INTERVAL_MS = 3000;
const BOX_DOWNLOAD_ATTEMPTS = 2;
const BOX_DOWNLOAD_CONTROL_TIMEOUT_MS = 10000;

function getKlaviyoKey(brandId) {
  const envName = BRAND_KEY_ENV[brandId];
  return envName ? process.env[envName] || null : null;
}

function getKlaviyoStatus() {
  return {
    ok: true,
    brandKeysPresent: Object.fromEntries(
      Object.entries(BRAND_KEY_ENV).map(([brandId, envName]) => [
        brandId,
        Boolean(process.env[envName]),
      ])
    ),
    revision: KLAVIYO_REVISION,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStartGate(minIntervalMs) {
  let lastStart = 0;
  let queue = Promise.resolve();

  return function waitForSlot() {
    const slot = queue.then(async () => {
      const delay = Math.max(0, minIntervalMs - (Date.now() - lastStart));
      if (delay) await sleep(delay);
      lastStart = Date.now();
    });

    queue = slot.catch(() => {});
    return slot;
  };
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
  return asset?.pageUrl || asset?.url || asset?.href || "";
}

function inferMimeTypeFromName(name) {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "image/jpeg";
}

function createAssetDescriptors(referenceImage, slices) {
  const descriptors = [];
  const referenceUrl = getAssetPageUrl(referenceImage);

  if (referenceImage && referenceUrl) {
    descriptors.push({
      asset: referenceImage,
      assetType: "reference",
      assetIndex: 0,
      assetName: normalizeAssetName(referenceImage, 0, "reference"),
      assetPageUrl: referenceUrl,
    });
  }

  slices.forEach((asset, assetIndex) => {
    descriptors.push({
      asset,
      assetType: "slice",
      assetIndex,
      assetName: normalizeAssetName(asset, assetIndex, "slice"),
      assetPageUrl: getAssetPageUrl(asset),
    });
  });

  return descriptors;
}

function validateUploadRequest({
  brandId,
  referenceImage,
  slices,
  existingUploadedImages = [],
}) {
  if (!brandId || !BRAND_KEY_ENV[brandId]) {
    const error = new Error("A supported brandId is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!referenceImage || !getAssetPageUrl(referenceImage)) {
    const error = new Error("A reference JPG Box file link is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(slices) || slices.length === 0) {
    const error = new Error("At least one Box slice is required.");
    error.statusCode = 400;
    throw error;
  }

  if (slices.length > 50) {
    const error = new Error("A maximum of 50 Box slices can be uploaded at once.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(existingUploadedImages)) {
    const error = new Error("existingUploadedImages must be an array.");
    error.statusCode = 400;
    throw error;
  }

  const descriptors = createAssetDescriptors(referenceImage, slices);
  if (descriptors.some(({ assetPageUrl }) => !assetPageUrl)) {
    const error = new Error("Every Box asset must include a file page URL.");
    error.statusCode = 400;
    throw error;
  }

  const parsedUrls = assertMatchingBoxShare(
    descriptors.map(({ assetPageUrl }) => assetPageUrl)
  );
  descriptors.forEach((descriptor, index) => {
    descriptor.assetPageUrl = parsedUrls[index].url;
    descriptor.asset = {
      ...descriptor.asset,
      pageUrl: parsedUrls[index].url,
      url: parsedUrls[index].url,
    };
  });

  if (!/\.(?:jpg|jpeg)$/i.test(descriptors[0].assetName)) {
    const error = new Error("The reference asset must be a JPG or JPEG.");
    error.statusCode = 400;
    throw error;
  }

  const invalidSlice = descriptors
    .slice(1)
    .find(({ assetName }) => !/\.(?:jpe?g|png|gif|webp)$/i.test(assetName));
  if (invalidSlice) {
    const error = new Error(
      `${invalidSlice.assetName} is not a supported slice image.`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    brandId,
    referenceImage: descriptors[0].asset,
    slices: descriptors.slice(1).map(({ asset }) => asset),
    existingUploadedImages,
    descriptors,
  };
}

async function readBoxPreviewAsBuffer(page, fallbackName) {
  const previewImage = page.locator('img.zoomable[src^="blob:"]').first();

  await previewImage.waitFor({
    state: "visible",
    timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
  });

  const dataUrl = await previewImage.evaluate(async (image) => {
    const response = await fetch(image.src);
    if (!response.ok) {
      throw new Error(`Box preview request failed with ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(reader.error || new Error("Could not read Box preview"));
      reader.readAsDataURL(blob);
    });
  });

  const match = /^data:([^;,]+)?;base64,(.+)$/s.exec(dataUrl || "");
  if (!match) {
    throw new Error(`Box preview data unavailable for ${fallbackName}`);
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    fileName: fallbackName,
    mimeType: match[1] || inferMimeTypeFromName(fallbackName),
    source: "preview",
  };
}

async function compressForKlaviyo(buffer, fileName, fallbackName, mimeType) {
  if (buffer.length <= MAX_UPLOAD_BYTES) {
    return {
      buffer,
      fileName,
      mimeType,
      compressed: false,
    };
  }

  const source = buffer;
  const attempts = [
    { size: 1600, quality: 82 },
    { size: 1400, quality: 76 },
    { size: 1200, quality: 70 },
  ];

  try {
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

    return {
      buffer,
      fileName:
        fileName.replace(/\.(png|gif|webp|jpe?g|bmp|tiff|psd)$/i, "") +
        ".jpg",
      mimeType: "image/jpeg",
      compressed: true,
    };
  } catch (error) {
    throw new Error(
      `Could not compress ${fallbackName} under Klaviyo's size limit: ${error.message}`
    );
  }
}

async function downloadBoxFile({
  context,
  waitForBoxDownloadSlot,
  filePageUrl,
  fallbackName,
}) {
  let lastDownloadError;

  for (let attempt = 1; attempt <= BOX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    await waitForBoxDownloadSlot();
    const page = await context.newPage();

    try {
      await page.goto(filePageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });

      const downloadButton = page
        .getByRole("button", { name: "Download", exact: true })
        .first();
      let downloaded;

      try {
        await downloadButton.waitFor({
          state: "visible",
          timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
        });

        const downloadPromise = page.waitForEvent("download", {
          timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
        });
        await downloadButton.click({
          timeout: BOX_DOWNLOAD_CONTROL_TIMEOUT_MS,
        });
        const download = await downloadPromise;
        const tempPath = await download.path();

        if (!tempPath) {
          throw new Error(`Box download path unavailable for ${fallbackName}`);
        }

        const fileName = download.suggestedFilename() || fallbackName;
        downloaded = {
          buffer: await fs.readFile(tempPath),
          fileName,
          mimeType: inferMimeTypeFromName(fileName),
          source: "download",
        };
      } catch (downloadError) {
        try {
          downloaded = await readBoxPreviewAsBuffer(page, fallbackName);
        } catch (previewError) {
          throw new Error(
            `${downloadError.message}; Box preview fallback failed: ${previewError.message}`
          );
        }
      }

      const prepared = await compressForKlaviyo(
        downloaded.buffer,
        downloaded.fileName,
        fallbackName,
        downloaded.mimeType
      );

      return {
        ...prepared,
        source: downloaded.source,
        byteLength: prepared.buffer.length,
      };
    } catch (error) {
      lastDownloadError = error;
    } finally {
      await page.close();
    }
  }

  throw new Error(
    `Could not retrieve ${fallbackName} from Box: ${
      lastDownloadError?.message || "unknown Box error"
    }`
  );
}

async function uploadOneAsset({
  apiKey,
  context,
  waitForBoxDownloadSlot,
  waitForUploadSlot,
  descriptor,
  onProgress,
}) {
  const {
    assetName,
    assetPageUrl,
    assetType,
  } = descriptor;

  onProgress?.({
    assetName,
    assetPageUrl,
    assetType,
    status: "downloading",
  });

  const {
    buffer,
    fileName,
    mimeType,
    source,
    compressed,
    byteLength,
  } = await downloadBoxFile({
    context,
    waitForBoxDownloadSlot,
    filePageUrl: assetPageUrl,
    fallbackName: assetName,
  });

  onProgress?.({
    assetName,
    assetPageUrl,
    assetType,
    status: "uploading",
    source,
    compressed,
  });

  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mimeType }), fileName);
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
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();

  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { rawText: text };
  }

  if (!response.ok) {
    throw new Error(
      parsed?.errors?.[0]?.detail ||
        parsed?.errors?.[0]?.title ||
        text ||
        `Klaviyo upload failed for ${assetName}`
    );
  }

  return {
    assetType,
    assetName,
    assetPageUrl,
    mimeType,
    source,
    compressed,
    byteLength,
    klaviyoImageId: parsed?.data?.id || null,
    klaviyoImageUrl: parsed?.data?.attributes?.image_url || null,
  };
}

function mergeUploadedImages(existing, uploaded, expectedUrls) {
  const byUrl = new Map();

  for (const image of [...existing, ...uploaded]) {
    if (!image?.assetPageUrl || !expectedUrls.has(image.assetPageUrl)) continue;
    byUrl.set(image.assetPageUrl, image);
  }

  return Array.from(byUrl.values());
}

async function uploadBoxAssets(input, { onProgress } = {}) {
  const validated = validateUploadRequest(input);
  const apiKey = getKlaviyoKey(validated.brandId);

  if (!apiKey) {
    const error = new Error(
      `No Klaviyo key configured for brandId "${validated.brandId}"`
    );
    error.statusCode = 400;
    throw error;
  }

  const expectedUrls = new Set(
    validated.descriptors.map(({ assetPageUrl }) => assetPageUrl)
  );
  const existingByUrl = new Map(
    validated.existingUploadedImages
      .filter((image) => expectedUrls.has(image?.assetPageUrl))
      .map((image) => [image.assetPageUrl, image])
  );
  const pendingDescriptors = validated.descriptors.filter(
    ({ assetPageUrl }) => !existingByUrl.has(assetPageUrl)
  );

  for (const descriptor of validated.descriptors) {
    onProgress?.({
      assetName: descriptor.assetName,
      assetPageUrl: descriptor.assetPageUrl,
      assetType: descriptor.assetType,
      status: existingByUrl.has(descriptor.assetPageUrl)
        ? "uploaded"
        : "pending",
      uploaded: existingByUrl.get(descriptor.assetPageUrl) || null,
      skipped: existingByUrl.has(descriptor.assetPageUrl),
      source: existingByUrl.get(descriptor.assetPageUrl)?.source,
      compressed: existingByUrl.get(descriptor.assetPageUrl)?.compressed,
    });
  }

  const results = [];
  let browser;

  try {
    if (pendingDescriptors.length) {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ acceptDownloads: true });
      const waitForBoxDownloadSlot = createStartGate(
        MIN_BOX_DOWNLOAD_INTERVAL_MS
      );
      const waitForUploadSlot = createStartGate(MIN_UPLOAD_INTERVAL_MS);

      for (const descriptor of pendingDescriptors) {
        try {
          const uploaded = await uploadOneAsset({
            apiKey,
            context,
            waitForBoxDownloadSlot,
            waitForUploadSlot,
            descriptor,
            onProgress,
          });
          results.push({ ok: true, uploaded, descriptor });
          onProgress?.({
            assetName: descriptor.assetName,
            assetPageUrl: descriptor.assetPageUrl,
            assetType: descriptor.assetType,
            status: "uploaded",
            uploaded,
            source: uploaded.source,
            compressed: uploaded.compressed,
          });
        } catch (error) {
          results.push({
            ok: false,
            descriptor,
            error: error.message,
          });
          onProgress?.({
            assetName: descriptor.assetName,
            assetPageUrl: descriptor.assetPageUrl,
            assetType: descriptor.assetType,
            status: "failed",
            error: error.message,
          });
        }
      }
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  const newlyUploaded = results
    .filter((result) => result.ok)
    .map((result) => result.uploaded);
  const uploadedImages = mergeUploadedImages(
    validated.existingUploadedImages,
    newlyUploaded,
    expectedUrls
  );
  const failedResults = results.filter((result) => !result.ok);
  const failedReferenceResult = failedResults.find(
    ({ descriptor }) => descriptor.assetType === "reference"
  );
  const failedReference = failedReferenceResult
    ? {
        referenceName: failedReferenceResult.descriptor.assetName,
        error: failedReferenceResult.error,
      }
    : null;
  const failedSlices = failedResults
    .filter(({ descriptor }) => descriptor.assetType === "slice")
    .map(({ descriptor, error }) => ({
      sliceName: descriptor.assetName,
      assetPageUrl: descriptor.assetPageUrl,
      error,
    }));
  const allSucceeded =
    !failedReference &&
    failedSlices.length === 0 &&
    uploadedImages.length === validated.descriptors.length;

  return {
    ok: allSucceeded,
    allSucceeded,
    expectedCount: validated.descriptors.length,
    uploadedImages,
    newlyUploadedCount: newlyUploaded.length,
    skippedCount: existingByUrl.size,
    failedReference,
    failedSlices,
  };
}

module.exports = {
  MAX_UPLOAD_BYTES,
  compressForKlaviyo,
  createAssetDescriptors,
  getKlaviyoStatus,
  uploadBoxAssets,
  validateUploadRequest,
};
