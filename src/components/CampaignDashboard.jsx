import CopyField from "./CopyField";

function CampaignDashboard({ selectedCampaign, selectedBrand }) {
    if (!selectedCampaign)
        return <p>Please select a campaign first.</p>;
    return (
        <>
        {selectedCampaign && (
        <div style={{ marginTop: "30px" }}>

            <hr />

            <section>
                <h3>Workzone</h3>

                <p>
                    <strong>Expected Project</strong>
                </p>

                <p>
                    {selectedBrand
                    ? `${selectedBrand.workzoneProjectPrefix} ${selectedCampaign.wzDate}`
                    : "Select a brand"}
                </p>

                <button style={{ marginTop: "10px" }}>
                    Find Project
                </button>
                </section>

            <section>
            <h3>Workzone Notes</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>
                {selectedCampaign.notes || "No Workzone notes found"}
            </pre>
            </section>

            <hr />
            <h2>Campaign Details</h2>
            
            <section>
                <h3>Campaign Status</h3>

                <p>
                    {selectedCampaign.status?.workbook
                    ? "🟢 Workbook Loaded"
                    : "⚪ Workbook Pending"}
                </p>

                <p>
                    {selectedCampaign.status?.workzone
                    ? "🟢 Workzone Loaded"
                    : "🟡 Workzone Pending"}
                </p>

                <p>
                    {selectedCampaign.status?.box
                    ? "🟢 Box Connected"
                    : "⚪ Box Pending"}
                </p>

                <p>
                    {selectedCampaign.status?.klaviyo
                    ? "🟢 Klaviyo Ready"
                    : "⚪ Klaviyo Pending"}
                </p>
            </section>

        

            <section>
            <h3>Campaign Information</h3>

            <CopyField
            label="WZ Date"
            value={selectedCampaign.wzDate}
            />

            <CopyField
            label="Send Date"
            value={selectedCampaign.sendDate}
            />

            <CopyField
            label="Subject Line"
            value={selectedCampaign.subjectLine}
            />

            <CopyField
            label="Preheader"
            value={selectedCampaign.preheader}
            />

            <CopyField
            label="Key Message"
            value={selectedCampaign.keyMessage}
            />

            <CopyField
            label="Message Type"
            value={selectedCampaign.messageType}
            />

            <p>
            <strong>Box Link:</strong>{" "}
            {selectedCampaign.boxLink ? (
                <a href={selectedCampaign.boxLink} target="_blank" rel="noreferrer">
                Open Box Folder
                </a>
            ) : (
                "Not found yet"
            )}
            </p>

            </section>

            <hr />

            <section>
            <h3>Dropbox</h3>

            <p>
                <strong>Folder:</strong>{" "}
                {selectedCampaign.dropboxFolder || "Not connected yet"}
            </p>

            <p>
                <strong>Reference Image:</strong>{" "}
                {selectedCampaign.referenceImage || "Not imported yet"}
            </p>

            <p>
                <strong>Slices:</strong>{" "}
                {selectedCampaign.slices?.length || 0}
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
                {selectedCampaign.items.map((item, index) => (
                    <tr key={index}>
                    <td>{item.image}</td>
                    <td>{item.product}</td>
                    <td>{item.cta}</td>
                    <td>
                        {item.link ? (
                        <a href={item.link} target="_blank" rel="noreferrer">
                            {item.link}
                        </a>
                        ) : (
                        "No link"
                        )}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </section>

            <hr />
            
            <hr />

            

        </div>
        )}
        </>
    );
}

export default CampaignDashboard;