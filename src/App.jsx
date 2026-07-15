import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { parseCampaigns } from "./utils/parseCampaigns";
import { brands } from "./data/brands";
import BrandSelector from "./components/BrandSelector";
import WorkbookUploader from "./components/WorkbookUploader";
import CampaignSelector from "./components/CampaignSelector";
import CampaignDashboard from "./components/CampaignDashboard";
import { getWorkzoneStatus } from "./api/workzoneApi";
import { inspectBoxFolder } from "./api/boxApi";

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
  const [apiStatus, setApiStatus] = useState("");
  const [manualBoxUrl, setManualBoxUrl] = useState("");
  const [isLoadingBox, setIsLoadingBox] = useState(false);
  
  useEffect(() => {
    async function checkBackend() {
      try {
        const status = await getWorkzoneStatus();
        setApiStatus(status.message);
      } catch (error) {
        setApiStatus("Backend unavailable");
      }
    }
  checkBackend();
  }, []);



  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;


    if (!selectedBrand) {
      setApiStatus("Please select a brand before uploading the workbook");
      return;
    }


    const reader = new FileReader();


    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, {
        type: "binary",
        cellDates: true,
      });


      const sheetName = workbook.SheetNames.includes(selectedBrand.worksheetName)
        ? selectedBrand.worksheetName
        : workbook.SheetNames[workbook.SheetNames.length - 1];


      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });


      const parsedCampaigns = parseCampaigns(rows);


      console.log("Selected brand:", selectedBrand);
      console.log("Sheet names:", workbook.SheetNames);
      console.log("Chosen sheet:", sheetName);
      console.log("Parsed campaigns:", parsedCampaigns);


      setCampaigns(parsedCampaigns);
      setSelectedIndex("");


      setApiStatus(
        parsedCampaigns.length > 0
          ? `Loaded ${parsedCampaigns.length} campaigns`
          : "No campaigns found in workbook"
      );
    };


    reader.readAsBinaryString(file);
  }

    async function handleLoadBoxAssets() {
      setIsLoadingBox(true);
      const boxUrl =
        selectedCampaign?.box?.folderUrl ||
        "https://gcg.box.com/s/7uxlpsyxxljtrhhiskakrxtw559x3kxp";

      try {
        const response = await inspectBoxFolder(boxUrl);
        console.log("Box assets response:", response);
        console.log("Box assets response assets:", response.assets);

        const assets = response.assets;

        const updatedCampaigns = campaigns.map((campaign, index) => {
          if (index !== Number(selectedIndex)) return campaign;

          return {
            ...campaign,
            box: {
              ...campaign.box,
              folderUrl: boxUrl,
              referenceJpgName: assets.referenceJpgName || "",
              referenceJpgUrl: assets.referenceJpgUrl || "",
              slicesFolderName: assets.slicesFolderName || "",
              slicesFolderUrl: assets.slicesFolderUrl || "",
            },
            status: {
              ...campaign.status,
              box: true,
            },
          };
        });

        setCampaigns(updatedCampaigns);
        setApiStatus("Box assets loaded");
        setIsLoadingBox(false);
      } catch (error) {
        console.error(error);
        setApiStatus("Failed to load Box assets");
        setIsLoadingBox(false);
      }
      finally {
        setIsLoadingBox(false);
      }
  }



  const selectedCampaign =
    selectedIndex !== "" ? campaigns[Number(selectedIndex)] : null;

  return (
    <div className="app">
      <header>
        <h1>Campaign Prep Tool</h1>
        <p>Email Marketing Workflow</p>
      </header>

      <div className="top-row">
        <div className="card half-width">
          <BrandSelector
            brands={brands}
            selectedBrandId={selectedBrandId}
            setSelectedBrandId={setSelectedBrandId}
            setCampaigns={setCampaigns}
            setSelectedIndex={setSelectedIndex}
          />
        </div>

        <div className="card half-width">
          <WorkbookUploader
            selectedBrand={selectedBrand}
            handleFileUpload={handleFileUpload}
          />
        </div>
      </div>

      <div className="card full-width">
      <CampaignSelector
        campaigns={campaigns}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
      />
      </div>

      <div className="card full-width">
        <CampaignDashboard 
        selectedCampaign={selectedCampaign}
        selectedBrand={selectedBrand} 
        handleLoadBoxAssets={handleLoadBoxAssets}
        isLoadingBox={isLoadingBox}
        manualBoxUrl={manualBoxUrl}
        setManualBoxUrl={setManualBoxUrl}
        />
      </div>
    </div>
  );
}

export default App;



