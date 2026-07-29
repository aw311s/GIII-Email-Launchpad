const ALLOWED_BOX_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*(?:app\.)?box\.com$/i;
const SHARED_PATH_PATTERN =
  /^\/s\/([a-z0-9_-]+)(?:\/(folder|file)\/(\d+))?\/?$/i;

function createBoxUrlError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.reason = "invalid_box_url";
  return error;
}

function parseBoxSharedUrl(value, expectedKind = null) {
  let parsed;

  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw createBoxUrlError("Enter a valid Box shared link.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    !ALLOWED_BOX_HOST_PATTERN.test(parsed.hostname)
  ) {
    throw createBoxUrlError(
      "Only HTTPS links from an approved Box domain are allowed."
    );
  }

  const pathMatch = SHARED_PATH_PATTERN.exec(parsed.pathname);
  if (!pathMatch) {
    throw createBoxUrlError(
      "Use a Box shared folder or file link containing /s/.../folder/... or /file/...."
    );
  }

  const [, shareToken, kind = null, itemId = null] = pathMatch;
  if (expectedKind && kind !== expectedKind) {
    throw createBoxUrlError(`A Box ${expectedKind} link is required.`);
  }

  parsed.search = "";
  parsed.hash = "";

  return {
    url: parsed.toString().replace(/\/$/, ""),
    hostname: parsed.hostname.toLowerCase(),
    shareToken,
    kind,
    itemId,
  };
}

function assertMatchingBoxShare(urls) {
  const parsedUrls = urls
    .filter(Boolean)
    .map((url) => parseBoxSharedUrl(url, "file"));
  const shareTokens = new Set(parsedUrls.map(({ shareToken }) => shareToken));

  if (shareTokens.size > 1) {
    throw createBoxUrlError(
      "All Box assets must come from the same shared folder."
    );
  }

  return parsedUrls;
}

module.exports = {
  assertMatchingBoxShare,
  parseBoxSharedUrl,
};
