import CopyField from "./CopyField";

function CampaignDashboard({ selectedCampaign, selectedBrand, handleLoadBoxAssets, isLoadingBox }) {
  if (!selectedCampaign) {
    return <p>Please select a campaign first.</p>;
  }

  const { workbook, workzone, box, klaviyo, status } = selectedCampaign;

  const expectedProjectName = selectedBrand?.workzone?.projectPrefix
    ? `${selectedBrand.workzone.projectPrefix} ${workbook.wzDate}`
    : "Select a brand";

  return (
    <div style={{ marginTop: "30px" }}>
      <hr />

      <h2>Campaign Details</h2>

      <section>
        <h3>Campaign Status</h3>

        <p>
          {status.workbook
            ? "🟢 Workbook Loaded"
            : "⚪ Workbook Pending"}
        </p>

        <p>
          {status.workzone
            ? "🟢 Workzone Loaded"
            : "🟡 Workzone Pending"}
        </p>

        <p>
          {status.box
            ? "🟢 Box Connected"
            : "⚪ Box Pending"}
        </p>

        <p>
          {status.klaviyo
            ? "🟢 Klaviyo Ready"
            : "⚪ Klaviyo Pending"}
        </p>
      </section>

      <hr />

      <section>
        <h3>Workbook</h3>

        <CopyField label="WZ Date" value={workbook.wzDate} />

        <CopyField label="Send Date" value={workbook.sendDate} />

        <CopyField label="Key Message" value={workbook.keyMessage} />

        <CopyField label="Message Type" value={workbook.messageType} />

        <CopyField label="Brief" value={workbook.brief} />
      </section>

      <hr />

      <section>
        <h3>Workzone</h3>

        <p>
          <strong>Expected Project:</strong>
        </p>

        <p>{expectedProjectName}</p>

        <button style={{ marginTop: "10px" }}>
          Find Project
        </button>

        <CopyField
          label="Subject Line"
          value={workzone.subjectLine}
        />

        <CopyField
          label="Preheader"
          value={workzone.preheader}
        />

        <p>
          <strong>Project:</strong>{" "}
          {workzone.projectName || "Not found yet"}
        </p>

        <p>
          <strong>Project URL:</strong>{" "}
          {workzone.projectUrl ? (
            <a
              href={workzone.projectUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Workzone Project
            </a>
          ) : (
            "Not found yet"
          )}
        </p>
      </section>

      <section>
        <h3>Workzone Notes</h3>

        <pre style={{ whiteSpace: "pre-wrap" }}>
          {workbook.notes || "No Workzone notes found"}
        </pre>
      </section>

      <hr />

      <section>
        <h3>Box</h3>

        <p>
            <strong>Folder:</strong>{" "}
            {box.folderUrl ? (
            <a href={box.folderUrl} target="_blank" rel="noreferrer">
                Open Box Folder
            </a>
            ) : (
            "Not connected yet"
            )}
        </p>

        <button
            style={{ marginTop: "10px", marginBottom: "10px" }}
            onClick={handleLoadBoxAssets}
            disabled={isLoadingBox}
        >
            {isLoadingBox ? "Loading Box Assets..." : "Load Box Assets"}
        </button>

        <p>
            <strong>Reference JPG:</strong>{" "}
            {box.referenceJpgName ? (
            <a href={box.referenceJpgUrl} target="_blank" rel="noreferrer">
                {box.referenceJpgName}
            </a>
            ) : (
            "Not imported yet"
            )}
        </p>

        <p>
            <strong>Slices Folder:</strong>{" "}
            {box.slicesFolderName ? (
            <a href={box.slicesFolderUrl} target="_blank" rel="noreferrer">
                {box.slicesFolderName}
            </a>
            ) : (
            "Not imported yet"
            )}
        </p>

        <p>
            <strong>Box Status:</strong>{" "}
            {box.folderUrl ? "🟢 Ready" : "⚪ Pending"}
        </p>
        </section>



      <hr />

      <section>
        <h3>Email Assets</h3>

        <table border="1" cellPadding="8">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product / Story</th>
              <th>CTA</th>
              <th>Link</th>
            </tr>
          </thead>

          <tbody>
            {workbook.items.length > 0 ? (
              workbook.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.image}</td>
                  <td>{item.product}</td>
                  <td>{item.cta}</td>
                  <td>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.link}
                      </a>
                    ) : (
                      "No link"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No email assets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <hr />

      <section>
        <h3>Klaviyo</h3>

        <p>
          <strong>Template:</strong>{" "}
          {klaviyo.templateName || "Not created yet"}
        </p>

        <p>
          <strong>Campaign ID:</strong>{" "}
          {klaviyo.campaignId || "Not created yet"}
        </p>

        <p>
          <strong>Uploaded Images:</strong>{" "}
          {klaviyo.uploadedImages.length}
        </p>
      </section>
    </div>
  );
}

export default CampaignDashboard;

