import { useEffect, useRef, useState } from "react";
import "./App.css";
import { brands } from "./data/brands";
import BrandSelector from "./components/BrandSelector";
import WorkbookUploader from "./components/WorkbookUploader";
import CampaignSelector from "./components/CampaignSelector";
import CampaignDashboard from "./components/CampaignDashboard";
import {
  loadWorkzoneProject,
  loadWorkzoneStatus,
} from "./features/workzone/workzoneService";
import { loadBoxAssetsForCampaign } from "./features/box/boxService";
import {
  loadBrandWorkbookFromSharePoint,
  loadWorkbook,
} from "./features/workbook/workbookService";
import {
  formatUploadResult,
  runBoxAssetUploadJob,
} from "./features/klaviyo/uploadJobService";

const BRAND_SESSION_KEY = "email-launchpad:selected-brand";
const CAMPAIGN_SESSION_KEY = "email-launchpad:selected-campaign";

function readSessionValue(key) {
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function getCampaignSessionKey(campaign) {
  const workbook = campaign?.workbook;
  return workbook
    ? [workbook.wzDate, workbook.sendDate, workbook.keyMessage].join("|")
    : "";
}

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState(() =>
    readSessionValue(BRAND_SESSION_KEY)
  );
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
  const [apiStatus, setApiStatus] = useState("");
  const [manualBoxUrl, setManualBoxUrl] = useState("");
  const [isLoadingBox, setIsLoadingBox] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    status: "idle",
    assets: [],
  });
  const [workbookLookup, setWorkbookLookup] = useState({
    status: "idle",
    message: "Select a brand to look for its SharePoint workbook.",
  });
  const [workzoneLookup, setWorkzoneLookup] = useState({
    status: "idle",
    message: "Select a campaign to look for its Workzone project.",
  });
  const manualBoxLoadTimeoutRef = useRef(null);
  const savedCampaignKeyRef = useRef(
    readSessionValue(CAMPAIGN_SESSION_KEY)
  );

  function restoreSavedCampaign(parsedCampaigns) {
    const savedKey = savedCampaignKeyRef.current;
    const savedIndex = savedKey
      ? parsedCampaigns.findIndex(
          (campaign) => getCampaignSessionKey(campaign) === savedKey
        )
      : -1;

    setSelectedIndex(savedIndex >= 0 ? String(savedIndex) : "");
  }

  useEffect(() => {
    try {
      if (selectedBrandId) {
        window.sessionStorage.setItem(BRAND_SESSION_KEY, selectedBrandId);
      } else {
        window.sessionStorage.removeItem(BRAND_SESSION_KEY);
      }
    } catch {
      // Session persistence is optional.
    }
  }, [selectedBrandId]);
  
  useEffect(() => {
    async function checkBackend() {
      try {
        const status = await loadWorkzoneStatus();
        setApiStatus(status.message);
      } catch {
        setApiStatus("Backend unavailable");
      }
    }
  checkBackend();
  }, []);

  useEffect(
    () => () => window.clearTimeout(manualBoxLoadTimeoutRef.current),
    []
  );

  useEffect(() => {
    if (!selectedBrandId || !selectedBrand) {
      setWorkbookLookup({
        status: "idle",
        message: "Select a brand to look for its SharePoint workbook.",
      });
      return undefined;
    }

    let cancelled = false;

    async function loadAutomaticWorkbook() {
      setWorkzoneLookup({
        status: "idle",
        message: "Select a campaign to look for its Workzone project.",
      });
      setManualBoxUrl("");
      setWorkbookLookup({
        status: "loading",
        message: `Looking for ${selectedBrand.workbookName} in SharePoint...`,
      });
      setApiStatus("Looking for the brand workbook in SharePoint...");

      try {
        const parsedCampaigns = await loadBrandWorkbookFromSharePoint(
          selectedBrand
        );
        if (cancelled) return;

        setCampaigns(parsedCampaigns);
        restoreSavedCampaign(parsedCampaigns);
        setWorkbookLookup({
          status: "automatic",
          message: `Loaded ${parsedCampaigns.length} campaign(s) from SharePoint.`,
        });
        setApiStatus("SharePoint workbook loaded.");
      } catch (error) {
        if (cancelled) return;

        setWorkbookLookup({
          status: "manual",
          message: `${error.message} Upload the workbook below instead.`,
        });
        setApiStatus("SharePoint unavailable. Manual workbook upload is ready.");
      }
    }

    loadAutomaticWorkbook();

    return () => {
      cancelled = true;
    };
  }, [selectedBrandId, selectedBrand]);

  async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!selectedBrand) {
    setApiStatus("Please select a brand before uploading the workbook");
    return;
  }

  try {
    const parsedCampaigns = await loadWorkbook(file, selectedBrand);

    console.log("Selected brand:", selectedBrand);
    console.log("Parsed campaigns:", parsedCampaigns);

    setCampaigns(parsedCampaigns);
    restoreSavedCampaign(parsedCampaigns);
    setManualBoxUrl("");
    setWorkzoneLookup({
      status: "idle",
      message: "Select a campaign to look for its Workzone project.",
    });
    setWorkbookLookup({
      status: "manual-loaded",
      message: `Loaded ${parsedCampaigns.length} campaign(s) from the manual workbook.`,
    });

    setApiStatus(
      parsedCampaigns.length > 0
        ? `Loaded ${parsedCampaigns.length} campaigns`
        : "No campaigns found in workbook"
    );
  } catch (error) {
    console.error(error);
    setApiStatus("Failed to load workbook");
    }
}

    async function handleCampaignSelection(value) {
      window.clearTimeout(manualBoxLoadTimeoutRef.current);
      setSelectedIndex(value);
      setManualBoxUrl("");
      setUploadProgress({ status: "idle", assets: [] });

      if (value === "") {
        savedCampaignKeyRef.current = "";
        window.sessionStorage.removeItem(CAMPAIGN_SESSION_KEY);
        setWorkzoneLookup({
          status: "idle",
          message: "Select a campaign to look for its Workzone project.",
        });
        return;
      }

      const campaignIndex = Number(value);
      const campaign = campaigns[campaignIndex];
      const campaignKey = getCampaignSessionKey(campaign);
      savedCampaignKeyRef.current = campaignKey;
      if (campaignKey) {
        window.sessionStorage.setItem(CAMPAIGN_SESSION_KEY, campaignKey);
      }
      const projectName = selectedBrand?.workzone?.projectPrefix
        ? `${selectedBrand.workzone.projectPrefix} ${campaign?.workbook?.wzDate || ""}`.trim()
        : "";

      if (!campaign || !projectName) return;

      setManualBoxUrl(campaign.box?.folderUrl || "");
      setWorkzoneLookup({
        status: "loading",
        message: `Looking for ${projectName} in Workzone...`,
      });
      setApiStatus("Looking for the Workzone project...");

      try {
        const project = await loadWorkzoneProject({
          brandId: selectedBrandId,
          projectName,
        });

        const boxFolderUrl =
          project.boxFolderUrl || campaign.box?.folderUrl || "";
        const updatedCampaign = {
          ...campaign,
          workzone: {
            ...campaign.workzone,
            projectName: project.projectName || projectName,
            projectUrl: project.projectUrl || "",
            subjectLine: project.subjectLine || "",
            preheader: project.preheader || "",
          },
          box: {
            ...campaign.box,
            folderUrl: boxFolderUrl,
          },
          status: { ...campaign.status, workzone: true },
        };

        setCampaigns((prev) =>
          prev.map((item, index) =>
            index === campaignIndex ? updatedCampaign : item
          )
        );
        setManualBoxUrl(boxFolderUrl);

        if (boxFolderUrl) {
          setWorkzoneLookup({
            status: "automatic",
            message: "Workzone project and asset drop link loaded automatically.",
          });
          await loadBoxAssetsAtIndex({
            campaignIndex,
            boxUrl: boxFolderUrl,
            campaign: updatedCampaign,
          });
        } else {
          setWorkzoneLookup({
            status: "manual",
            message:
              "Workzone project loaded, but it did not contain an asset drop link. Paste it below.",
          });
          setApiStatus(
            "Workzone project loaded, but no asset drop link was found."
          );
        }
      } catch (error) {
        setWorkzoneLookup({
          status: "manual",
          message: `${error.message} Paste the campaign asset drop link below.`,
        });
        setApiStatus("Workzone unavailable. Manual drop-link input is ready.");
      }
    }

    function handleManualBoxUrlSave(folderUrlValue = manualBoxUrl) {
      const folderUrl = String(folderUrlValue || "").trim();

      try {
        const parsedUrl = new URL(folderUrl);
        if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error();
      } catch {
        setApiStatus("Enter a valid http or https asset drop link.");
        return;
      }

      const campaignIndex = Number(selectedIndex);
      const campaign = campaigns[campaignIndex];
      if (!campaign || isLoadingBox) return;

      loadBoxAssetsAtIndex({ campaignIndex, boxUrl: folderUrl, campaign });
    }

    function handleManualBoxUrlChange(value) {
      setManualBoxUrl(value);
      window.clearTimeout(manualBoxLoadTimeoutRef.current);

      if (workzoneLookup.status !== "manual" || selectedIndex === "") return;

      const folderUrl = value.trim();
      try {
        const parsedUrl = new URL(folderUrl);
        if (!/^https?:$/.test(parsedUrl.protocol)) return;
      } catch {
        return;
      }

      manualBoxLoadTimeoutRef.current = window.setTimeout(() => {
        handleManualBoxUrlSave(folderUrl);
      }, 600);
    }

    async function loadBoxAssetsAtIndex({ campaignIndex, boxUrl, campaign }) {
      const currentCampaign = campaign || campaigns[campaignIndex];
      const campaignWithBoxUrl = currentCampaign
        ? {
            ...currentCampaign,
            box: { ...currentCampaign.box, folderUrl: boxUrl },
          }
        : null;

      if (!campaignWithBoxUrl || !boxUrl) return null;

      setCampaigns((prev) =>
        prev.map((item, index) =>
          index === campaignIndex ? campaignWithBoxUrl : item
        )
      );
      setIsLoadingBox(true);
      setApiStatus("Loading Box assets...");

      try {
        console.log("Loading Box for campaign:", campaignIndex);
        console.log("Box URL:", boxUrl);

        const updatedCampaign = await loadBoxAssetsForCampaign(
          campaignWithBoxUrl,
          boxUrl
        );

        console.log("Updated campaign:", updatedCampaign);

        setCampaigns((prev) =>
          prev.map((item, index) =>
            index === campaignIndex ? updatedCampaign : item
          )
        );
        setApiStatus("Box assets loaded");
        return updatedCampaign;
      } catch (error) {
        console.error("Box load error:", error);
        setApiStatus(error.message || "Failed to load Box assets");
        return null;
      } finally {
        setIsLoadingBox(false);
      }
    }

    async function handleLoadBoxAssets() {
      if (selectedIndex === "") {
        setApiStatus("Please select a campaign first");
        return;
      }

      const campaignIndex = Number(selectedIndex);
      const campaign = campaigns[campaignIndex];
      const boxUrl = campaign?.box?.folderUrl || manualBoxUrl.trim();

      if (!boxUrl) {
        setApiStatus(
          "No asset drop link found. Paste the manual link in the Workzone section."
        );
        return;
      }

      await loadBoxAssetsAtIndex({ campaignIndex, boxUrl, campaign });
    }



    const handleUploadSlicesToKlaviyo = async () => {
      if (!selectedBrandId || selectedIndex === "") {
        return;
      }

      const campaignIndex = Number(selectedIndex);
      const campaign = campaigns[campaignIndex];

      if (!campaign) {
        return;
      }

      const slices = campaign.box?.slices || [];
      const referenceImageUrl =
        campaign.box?.referenceJpgDownloadUrl ||
        campaign.box?.referenceJpgUrl ||
        "";

      if (!referenceImageUrl) {
        setApiStatus("No reference JPG loaded. Reload the Box assets.");
        return;
      }

      if (!slices.length) {
        setApiStatus("No slice files loaded. Reload the Box assets.");
        return;
      }

      setIsUploadingImages(true);
      setApiStatus("Uploading Box assets to Klaviyo...");
      setUploadProgress({
        status: "queued",
        assets: [
          {
            assetType: "reference",
            assetName: campaign.box?.referenceJpgName || "reference.jpg",
            assetPageUrl: referenceImageUrl,
            status: "pending",
          },
          ...slices.map((slice, index) => ({
            assetType: "slice",
            assetName: slice.name || `slice-${index + 1}`,
            assetPageUrl: slice.pageUrl || slice.url,
            status: "pending",
          })),
        ],
      });

      try {
        const result = await runBoxAssetUploadJob({
          brandId: selectedBrandId,
          referenceImage: {
            name: campaign.box?.referenceJpgName || "reference.jpg",
            url: referenceImageUrl,
            pageUrl: referenceImageUrl,
          },
          slices,
          existingUploadedImages: campaign.klaviyo?.uploadedImages || [],
          onProgress: (job) => {
            setUploadProgress({
              status: job.status,
              assets: job.assets || [],
            });
          },
        });

        setCampaigns((prev) =>
          prev.map((item, index) => {
            if (index !== campaignIndex) {
              return item;
            }

            return {
              ...item,
              klaviyo: {
                ...item.klaviyo,
                uploadedImages: result.uploadedImages,
              },
              status: {
                ...item.status,
                klaviyo: result.allSucceeded,
              },
            };
          })
        );

        setApiStatus(formatUploadResult(result));
      } catch (error) {
        console.error(error);
        setUploadProgress((current) => ({
          ...current,
          status: "failed",
        }));
        setApiStatus(error.message || "Klaviyo upload failed.");
      } finally {
        setIsUploadingImages(false);
      }
    };



  const selectedCampaign =
    selectedIndex !== "" ? campaigns[Number(selectedIndex)] : null;

  return (
    <div className="app">
      <header>
        <h1>Email Launchpad</h1>
        <p>G-III Email Marketing</p>
      </header>

      <div className="card full-width" style={{ marginTop: "12px" }}>
          <div className="api-status" role="status" aria-live="polite">
            {apiStatus || "Ready"}
          </div>
      </div>

      <div className="top-row">
        <div className="card half-width">
          <BrandSelector
            brands={brands}
            selectedBrandId={selectedBrandId}
            setSelectedBrandId={(brandId) => {
              if (brandId !== selectedBrandId) {
                savedCampaignKeyRef.current = "";
                window.sessionStorage.removeItem(CAMPAIGN_SESSION_KEY);
              }
              setSelectedBrandId(brandId);
            }}
            setCampaigns={setCampaigns}
            setSelectedIndex={setSelectedIndex}
          />
        </div>

        <div className="card half-width">
          <WorkbookUploader
            selectedBrand={selectedBrand}
            handleFileUpload={handleFileUpload}
            lookupStatus={workbookLookup.status}
            lookupMessage={workbookLookup.message}
          />
        </div>
      </div>

      <div className="card full-width">
      <CampaignSelector
        campaigns={campaigns}
        selectedIndex={selectedIndex}
        setSelectedIndex={handleCampaignSelection}
      />
      </div>

      <div className="card full-width">
        <CampaignDashboard 
        selectedCampaign={selectedCampaign}
        selectedBrand={selectedBrand} 
        handleLoadBoxAssets={handleLoadBoxAssets}
        isLoadingBox={isLoadingBox}
        handleUploadSlicesToKlaviyo={handleUploadSlicesToKlaviyo}
        isUploadingImages={isUploadingImages}
        uploadProgress={uploadProgress}
        workzoneLookup={workzoneLookup}
        retryWorkzoneLookup={() => handleCampaignSelection(selectedIndex)}
        manualBoxUrl={manualBoxUrl}
        handleManualBoxUrlChange={handleManualBoxUrlChange}
        />
      </div>
    </div>
  );
}

export default App;
