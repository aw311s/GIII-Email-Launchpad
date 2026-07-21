import CopyField from "./CopyField";


function CampaignDashboard({
  selectedCampaign,
  selectedBrand,
  handleLoadBoxAssets,
  isLoadingBox,
  handleUploadSlicesToKlaviyo,
  isUploadingImages,
  workzoneLookup,
  retryWorkzoneLookup,
  manualBoxUrl,
  handleManualBoxUrlChange,
}) {
  if (!selectedCampaign) {
    return (
      <div className="dashboard-empty">
        Please select a campaign first.
      </div>
    );
  }


  const { workbook, workzone, box, klaviyo, status } = selectedCampaign;


  const expectedProjectName = selectedBrand?.workzone?.projectPrefix
    ? `${selectedBrand.workzone.projectPrefix} ${workbook.wzDate}`
    : "Select a brand";
  const hasBoxAssets = Boolean(
    box.referenceJpgDownloadUrl ||
      box.referenceJpgUrl ||
      box.slices?.length
  );


  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <h2>Campaign Details</h2>
          <p>Review workbook data, Box assets, and launch readiness.</p>
        </div>


        <div className="dashboard-badges">
          <span className={status.workbook ? "badge badge--good" : "badge"}>
            {status.workbook ? "Workbook Loaded" : "Workbook Pending"}
          </span>
          <span className={status.workzone ? "badge badge--good" : "badge"}>
            {status.workzone ? "Workzone Loaded" : "Workzone Pending"}
          </span>
          <span className={status.box ? "badge badge--good" : "badge"}>
            {status.box ? "Box Ready" : "Box Pending"}
          </span>
          <span className={status.klaviyo ? "badge badge--good" : "badge"}>
            {status.klaviyo ? "Klaviyo Ready" : "Klaviyo Pending"}
          </span>
        </div>
      </div>


      <section className="panel">
        <div className="panel__header">
          <h3>Workbook</h3>
        </div>


        <div className="field-grid">
          <CopyField label="WZ Date" value={workbook.wzDate} />
          <CopyField label="Send Date" value={workbook.sendDate} />
          <CopyField label="Key Message" value={workbook.keyMessage} />
          <CopyField label="Message Type" value={workbook.messageType} />
        </div>


        <div className="brief-card">
          <div className="field-label">Brief</div>
          <div className="brief-text">
            {workbook.brief || "No brief available"}
          </div>
        </div>
      </section>


      <section className="panel">
        <div className="panel__header">
          <h3>Workzone</h3>
        </div>

        <div className={`source-status source-status--${workzoneLookup.status}`}>
          {workzoneLookup.message}
        </div>


        <div className="field-grid">
          <CopyField label="Subject Line" value={workzone.subjectLine} />
          <CopyField label="Preheader" value={workzone.preheader} />
        </div>


        <div className="info-row">
          <div className="info-label">Expected Project</div>
          <div className="info-value">{expectedProjectName}</div>
        </div>


        <div className="info-row">
          <div className="info-label">Project</div>
          <div className="info-value">
            {workzone.projectName || "Not found yet"}
          </div>
        </div>


        <div className="info-row">
          <div className="info-label">Project URL</div>
          <div className="info-value">
            {workzone.projectUrl ? (
              <a href={workzone.projectUrl} target="_blank" rel="noreferrer">
                Open Workzone Project
              </a>
            ) : (
              "Not found yet"
            )}
          </div>
        </div>


        {workzoneLookup.status === "manual" && (
          <div className="manual-fallback">
            <label className="field-label" htmlFor="manual-box-url">
              Manual campaign asset drop link
            </label>
            <input
              id="manual-box-url"
              type="url"
              value={manualBoxUrl}
              onChange={(event) =>
                handleManualBoxUrlChange(event.target.value)
              }
              placeholder="https://..."
            />
            <div className="field-help">
              Assets load automatically after a valid link is entered.
            </div>
          </div>
        )}

        <button
          type="button"
          className="secondary-button"
          style={{ marginTop: "12px" }}
          onClick={retryWorkzoneLookup}
          disabled={workzoneLookup.status === "loading"}
        >
          {workzoneLookup.status === "loading"
            ? "Looking for Project..."
            : "Retry Workzone Lookup"}
        </button>
      </section>


      <section className="panel">
        <div className="panel__header">
          <h3>Workzone Notes</h3>
        </div>


        <pre className="notes-box">
          {workbook.notes || "No Workzone notes found"}
        </pre>
      </section>


      <section className="panel">
        <div className="panel__header panel__header--split">
            <h3>Box</h3>
            <button
            className="primary-button"
            onClick={handleLoadBoxAssets}
            disabled={isLoadingBox}
            >
            {isLoadingBox ? "Loading Box Assets..." : "Load Box Assets"}
            </button>
        </div>


        <div className="info-row">
            <div className="info-label">Folder</div>
            <div className="info-value">
            {box.folderUrl ? (
                <a href={box.folderUrl} target="_blank" rel="noreferrer">
                Open Box Folder
                </a>
            ) : (
                "Not connected yet"
            )}
            </div>
        </div>


        <div className="field-grid">
            <div className="asset-card">
            <div className="field-label">Reference JPG</div>
            <div className="asset-title">
                {box.referenceJpgName || "Not imported yet"}
            </div>


            {box.referenceJpgUrl && (
                <div className="asset-actions">
                <a
                    className="primary-button"
                    href={box.referenceJpgUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open
                </a>
                </div>
            )}
            </div>

            <div className="asset-card">
            <div className="field-label">Slices Folder</div>
            <div className="asset-title">
                {box.slicesFolderName || "Not imported yet"}
            </div>

            {box.slicesFolderUrl && (
                <div className="asset-actions">
                <a
                    className="primary-button"
                    href={box.slicesFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open Folder
                </a>
                </div>
            )}
            </div>
        </div>

        <div className="info-row">
            <div className="info-label">Box Status</div>
            <div className={box.folderUrl ? "badge badge--good" : "badge"}>
                {box.folderUrl ? "Ready" : "Pending"}
            </div>
        </div>
        <div className="asset-actions" style={{ marginTop: "12px" }}>
        <button
            type="button"
            className="primary-button"
            onClick={handleUploadSlicesToKlaviyo}
            disabled={isUploadingImages || !hasBoxAssets}
        >
            {isUploadingImages ? "Uploading Box assets..." : "Upload Box assets to Klaviyo"}
        </button>
        </div>


        </section>

        <section className="panel">
        <div className="panel__header">
            <h3>Email Assets</h3>
        </div>


        {workbook.items.length > 0 ? (
            <div className="table-wrap">
            <table className="modern-table">
                <thead>
                <tr>
                    <th>Image</th>
                    <th>Product / Story</th>
                    <th>CTA</th>
                    <th>Link</th>
                </tr>
                </thead>
                <tbody>
                {workbook.items.map((item, index) => (
                    <tr key={index}>
                    <td>{item.image || "—"}</td>
                    <td>{item.product || "—"}</td>
                    <td>{item.cta || "—"}</td>
                    <td>
                        {item.link ? (
                        <div className="asset-actions">
                            <a
                            className="primary-button"
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            >
                            Open
                            </a>


                            <button
                            type="button"
                            className="secondary-button"
                            onClick={() => navigator.clipboard.writeText(item.link)}
                            >
                            Copy
                            </button>
                        </div>
                        ) : (
                        "No link"
                        )}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        ) : (
            <div className="empty-state">No email assets found.</div>
        )}
        </section>

        <section className="panel">
        <div className="panel__header">
            <h3>Klaviyo</h3>
        </div>


        <div className="field-grid">
            <CopyField label="Template" value={klaviyo.templateName} />
            <CopyField label="Campaign ID" value={klaviyo.campaignId} />
        </div>


        <div className="info-row">
        <div className="info-label">Uploaded Images</div>
        <div className="info-value">{klaviyo.uploadedImages.length}</div>
        </div>

        {klaviyo.uploadedImages.length > 0 && (
        <div style={{ marginTop: "16px" }}>
            <div className="field-label">Uploaded Image Details</div>
            <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            {klaviyo.uploadedImages.map((image, index) => (
                <div key={`${image.assetName || image.sliceName}-${index}`} className="brief-card">
                <div className="asset-title">{image.assetName || image.sliceName}</div>
                <div className="info-value">
                    {image.klaviyoImageUrl || image.klaviyoImageId || "Uploaded"}
                </div>
                </div>
            ))}
            </div>
        </div>
        )}


        </section>
            </div>
  );
}

export default CampaignDashboard;
