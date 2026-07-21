import { inspectBoxFolder } from "../../api/boxApi";

export async function loadBoxAssetsForCampaign(campaign, fallbackBoxUrl) {
  const boxUrl = campaign?.box?.folderUrl || fallbackBoxUrl;

  const response = await inspectBoxFolder(boxUrl);
  const assets = response.assets;

  return {
    ...campaign,
    box: {
      ...campaign.box,
      folderUrl: boxUrl,
      referenceJpgName: assets.referenceJpgName || "",
      referenceJpgUrl: assets.referenceJpgUrl || "",
      referenceJpgDownloadUrl: assets.referenceJpgDownloadUrl || "",
      slicesFolderName: assets.slicesFolderName || "",
      slicesFolderUrl: assets.slicesFolderUrl || "",
      slices: assets.slices || [],
    },
    status: {
      ...campaign.status,
      box: true,
    },
  };
}



