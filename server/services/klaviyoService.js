const axios = require("axios");

const API_KEYS = {
  dkny: process.env.KLAVIYO_API_KEY_DKNY,
  "karl-lagerfeld": process.env.KLAVIYO_API_KEY_KARL,
  "donna-karan": process.env.KLAVIYO_API_KEY_DONNA,
};

function getApiKey(brandId) {
  const key = API_KEYS[brandId];

  if (!key) {
    throw new Error(`No Klaviyo API key configured for ${brandId}`);
  }

  return key;
}

async function getLatestTemplates(brandId) {
  const apiKey = getApiKey(brandId);

  const response = await axios.get("https://a.klaviyo.com/api/templates", {
    params: {
      sort: "-updated",
      "page[size]": 10,
    },
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: "2026-04-15",
    },
  });

  const templates = (response.data?.data || []).map((template) => ({
    id: template.id,
    name: template.attributes?.name || "",
  }));

  return templates;
}

module.exports = {
  getApiKey,
  getLatestTemplates,
};

