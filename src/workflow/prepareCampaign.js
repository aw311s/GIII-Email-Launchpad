import { inspectBoxFolder } from "../api/boxApi";

export async function prepareCampaign(campaign) {
  const result = {
    workzone: null,
    box: null,
    klaviyo: null,
  };

  // Temporary until Workzone is connected
  const boxUrl =
    campaign.box.folderUrl ||
    "https://gcg.box.com/s/7uxlpsyxxljtrhhiskakrxtw559x3kxp";

  result.box = await inspectBoxFolder(boxUrl);

  return result;
}

