
const axios = require("axios");
const config = require("../config");

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getStatus() {
  const configured =
    Boolean(config.workzone.clientId) &&
    Boolean(config.workzone.clientSecret) &&
    Boolean(config.workzone.tokenUrl) &&
    Boolean(config.workzone.apiBaseUrl);


  if (!configured) {
    return {
      connected: false,
      configured: false,
      state: "not_configured",
      message: "Workzone is not configured. Manual drop-link entry is available.",
    };
  }

  try {
    await getAccessToken();
    return {
      connected: true,
      configured: true,
      state: "connected",
      message: "Workzone authentication succeeded.",
    };
  } catch {
    return {
      connected: false,
      configured: true,
      state: "connection_failed",
      message: "Workzone is configured, but authentication failed.",
    };
  }
}


async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const {
    clientId,
    clientSecret,
    tokenUrl,
    apiBaseUrl,
  } = config.workzone;


  const missingValues = [];


  if (!clientId) missingValues.push("WORKZONE_CLIENT_ID");
  if (!clientSecret) missingValues.push("WORKZONE_CLIENT_SECRET");
  if (!tokenUrl) missingValues.push("WORKZONE_TOKEN_URL");
  if (!apiBaseUrl) missingValues.push("WORKZONE_API_BASE_URL");


  if (missingValues.length > 0) {
    throw new Error(
      `Workzone is not configured. Missing: ${missingValues.join(", ")}`
    );
  }


  const params = new URLSearchParams();


  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("grant_type", "client_credentials");


  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15_000,
    });


    const accessToken = response.data?.access_token;


    if (!accessToken) {
      throw new Error("Workzone did not return an access token");
    }


    cachedToken = accessToken;
    cachedTokenExpiresAt =
      Date.now() + Number(response.data?.expires_in || 3600) * 1000;
    return cachedToken;
  } catch (error) {
    if (error.response) {
      console.error(
        "Workzone authentication response:",
        error.response.status,
        error.response.data
      );
    }


    throw new Error(
      error.message === "Workzone did not return an access token"
        ? error.message
        : "Unable to authenticate with Workzone"
    );
  }
}

async function findProject({ projectName }) {
  await getAccessToken();

  const error = new Error(
    `Workzone is connected, but project lookup for "${projectName}" still needs the Workzone endpoint mapping`
  );
  error.statusCode = 501;
  error.reason = "lookup_not_implemented";
  error.fallbackRequired = true;
  throw error;
}







module.exports = {
  getStatus,
  getAccessToken,
  findProject,
};
