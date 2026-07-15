function CampaignSelector({
  campaigns,
  selectedIndex,
  setSelectedIndex,
}) {
  if (campaigns.length === 0) return null;

  return (
    <>
      <h2>Select Campaign</h2>

      <select
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(e.target.value)}
      >
        <option value="">Choose a campaign</option>

        {campaigns.map((campaign, index) => (
          <option key={index} value={index}>
            {campaign.workbook.wzDate} — {campaign.workbook.keyMessage}
          </option>
        ))}
      </select>
    </>
  );
}

export default CampaignSelector;

