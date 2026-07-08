function WorkbookUploader({ selectedBrand, handleFileUpload }) {
  return (
    <>
      <h2>Upload Workbook</h2>

      {selectedBrand ? (
        <>
          <p>
            Expected workbook: <strong>{selectedBrand.workbookName}</strong>
          </p>

          <p>
            Workzone Area: <strong>{selectedBrand.workzoneArea}</strong>
          </p>
        </>
      ) : (
        <p>Please select a brand first.</p>
      )}

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        disabled={!selectedBrand}
      />
    </>
  );
}

export default WorkbookUploader;

