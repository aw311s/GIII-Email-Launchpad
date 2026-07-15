
const axios = require("axios");
const config = require("../config");

async function getStatus() {
  const configured =
    Boolean(config.workzone.clientId) &&
    Boolean(config.workzone.clientSecret) &&
    Boolean(config.workzone.tokenUrl) &&
    Boolean(config.workzone.apiBaseUrl);


  return {
    connected: false,
    configured,
    message: configured
      ? "Workzone configured"
      : "Workzone not configured",
  };
}


async function getAccessToken() {
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
    });


    const accessToken = response.data?.access_token;


    if (!accessToken) {
      throw new Error("Workzone did not return an access token");
    }


    return accessToken;
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







module.exports = {
  getStatus,
  getAccessToken,
};
