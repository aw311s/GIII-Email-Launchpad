function BrandSelector({
  brands,
  selectedBrandId,
  setSelectedBrandId,
  setCampaigns,
  setSelectedIndex,
}) {
  return (
    <>
      <h2>Select Brand</h2>

      <select
        value={selectedBrandId}
        onChange={(e) => {
          setSelectedBrandId(e.target.value);
          setCampaigns([]);
          setSelectedIndex("");
        }}
      >
        <option value="">Choose a brand</option>

        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </>
  );
}

export default BrandSelector;


