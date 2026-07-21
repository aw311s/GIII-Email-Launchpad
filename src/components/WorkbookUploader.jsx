function WorkbookUploader({
  selectedBrand,
  handleFileUpload,
  lookupStatus,
  lookupMessage,
}) {
  const showManualUpload =
    selectedBrand && ["manual", "manual-loaded"].includes(lookupStatus);

  return (
    <>
      <h2>Workbook</h2>

      {selectedBrand ? (
        <>
          <p>
            Expected workbook: <strong>{selectedBrand.workbookName}</strong>
          </p>

          <p>
            Workzone Area: <strong>{selectedBrand.workzone.area}</strong>
          </p>

          <div className={`source-status source-status--${lookupStatus}`}>
            {lookupMessage}
          </div>
        </>
      ) : (
        <p>Please select a brand first.</p>
      )}

      {showManualUpload && (
        <label className="manual-fallback">
          <span className="field-label">Manual workbook upload</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
        </label>
      )}
    </>
  );
}

export default WorkbookUploader;
