import { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { parseCampaigns } from "./utils/parseCampaigns";
import { brands } from "./data/brands";
import BrandSelector from "./components/BrandSelector";
import WorkbookUploader from "./components/WorkbookUploader";
import CampaignSelector from "./components/CampaignSelector";
import CampaignDashboard from "./components/CampaignDashboard";

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);

  function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary", cellDates: true });

      const sheetName = workbook.SheetNames.includes(selectedBrand.worksheetName)
        ? selectedBrand.worksheetName
        : workbook.SheetNames[workbook.SheetNames.length - 1];

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const parsedCampaigns = parseCampaigns(rows);
      setCampaigns(parsedCampaigns);
      setSelectedIndex("");
    };

    reader.readAsBinaryString(file);
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
        />
      </div>
    </div>
  );
}

export default App;



