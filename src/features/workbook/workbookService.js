import { parseCampaigns } from "./parseCampaigns";
import { fetchBrandWorkbookFromSharePoint } from "./sharePointWorkbookApi";

export async function loadWorkbook(file, selectedBrand) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames.includes(selectedBrand.worksheetName)
    ? selectedBrand.worksheetName
    : workbook.SheetNames[workbook.SheetNames.length - 1];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  return parseCampaigns(rows);
}

export async function loadBrandWorkbookFromSharePoint(selectedBrand) {
  const workbookBlob = await fetchBrandWorkbookFromSharePoint(
    selectedBrand.id
  );

  return loadWorkbook(workbookBlob, selectedBrand);
}
