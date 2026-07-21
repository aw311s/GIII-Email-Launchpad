const axios = require("axios");
const config = require("../config");

function getMissingConfig(brandId) {
  const { sharepoint } = config;
  const required = [
    ["MICROSOFT_TENANT_ID", sharepoint.tenantId],
    ["MICROSOFT_CLIENT_ID", sharepoint.clientId],
    ["MICROSOFT_CLIENT_SECRET", sharepoint.clientSecret],
    ["SHAREPOINT_SITE_ID", sharepoint.siteId],
    ["SHAREPOINT_DRIVE_ID", sharepoint.driveId],
  ];

  const workbookPath = sharepoint.workbookPaths[brandId];
  const pathEnvNames = {
    dkny: "SHAREPOINT_WORKBOOK_PATH_DKNY",
    "karl-lagerfeld": "SHAREPOINT_WORKBOOK_PATH_KARL",
    "donna-karan": "SHAREPOINT_WORKBOOK_PATH_DONNA",
  };

  required.push([pathEnvNames[brandId] || "SHAREPOINT_WORKBOOK_PATH", workbookPath]);

  return required.filter(([, value]) => !value).map(([name]) => name);
}

function createUnavailableError(message, missingConfig = []) {
  const error = new Error(message);
  error.statusCode = 503;
  error.reason = "not_configured";
  error.fallbackRequired = true;
  error.missingConfig = missingConfig;
  return error;
}

async function getAccessToken() {
  const { tenantId, clientId, clientSecret } = config.sharepoint;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await axios.post(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  if (!response.data?.access_token) {
    throw new Error("SharePoint authentication did not return an access token");
  }

  return response.data.access_token;
}

function encodeDrivePath(path) {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

async function getWorkbookForBrand(brandId) {
  const missingConfig = getMissingConfig(brandId);
  if (missingConfig.length) {
    throw createUnavailableError(
      "SharePoint workbook lookup is not configured yet.",
      missingConfig
    );
  }

  const { siteId, driveId, workbookPaths } = config.sharepoint;

  try {
    const token = await getAccessToken();
    const encodedPath = encodeDrivePath(workbookPaths[brandId]);
    const url =
      `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}` +
      `/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}:/content`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
      maxRedirects: 5,
    });

    return {
      buffer: Buffer.from(response.data),
      contentType:
        response.headers["content-type"] ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: workbookPaths[brandId].split("/").pop(),
    };
  } catch (error) {
    const lookupError = new Error(
      "SharePoint workbook lookup failed. Use the manual workbook upload."
    );
    lookupError.statusCode = 502;
    lookupError.reason = "lookup_failed";
    lookupError.fallbackRequired = true;
    lookupError.cause = error;
    throw lookupError;
  }
}

function getStatus() {
  const brands = Object.keys(config.sharepoint.workbookPaths);
  const missingByBrand = Object.fromEntries(
    brands.map((brandId) => [brandId, getMissingConfig(brandId)])
  );

  return {
    connected: false,
    configured: brands.every((brandId) => missingByBrand[brandId].length === 0),
    missingByBrand,
  };
}

module.exports = {
  getStatus,
  getWorkbookForBrand,
};
