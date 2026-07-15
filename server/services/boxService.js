const { chromium } = require("playwright");

function normalizeUrl(url) {
  return String(url || "").trim();
}

async function inspectSharedBoxFolder(folderUrl) {
  const url = normalizeUrl(folderUrl);

  if (!url) {
    throw new Error("No Box folder URL provided");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    const links = await page.$$eval("a", (anchors) =>
      anchors
        .map((a) => ({
          text: (a.innerText || a.textContent || "").trim(),
          href: a.href || "",
        }))
        .filter((link) => link.href)
    );

    const jpgLink = links.find(
      (link) =>
        /\.jpe?g(\?|$)/i.test(link.href) ||
        /\.jpe?g(\?|$)/i.test(link.text)
    );

    const slicesFolderLink = links.find(
      (link) =>
        /slices/i.test(link.text) ||
        /folder/i.test(link.href)
    );

    return {
      folderUrl: url,
      referenceJpgName: jpgLink?.text || "",
      referenceJpgUrl: jpgLink?.href || "",
      slicesFolderName: slicesFolderLink?.text || "",
      slicesFolderUrl: slicesFolderLink?.href || "",
      debugLinks: links.slice(0, 25),
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  inspectSharedBoxFolder,
};

