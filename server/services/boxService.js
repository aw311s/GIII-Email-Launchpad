const { chromium } = require("playwright");

function dedupeLinks(links) {
  const seen = new Set();

  return links.filter((link) => {
    if (!link.href) return false;
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

function normalizeText(value) {
  return (value || "").trim();
}

function isFileLink(href) {
  return /\/file\//i.test(href || "");
}

function isFolderLink(href) {
  return /\/folder\//i.test(href || "");
}

function pickBestLink(links, predicate) {
  return links.find((link) => predicate(link)) || null;
}

function linkTextBundle(link) {
  return [link.text, link.title, link.ariaLabel, link.href]
    .filter(Boolean)
    .join(" ");
}

async function collectLinks(page) {
  const links = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      text: (anchor.textContent || "").trim(),
      href: anchor.href || "",
      title: (anchor.getAttribute("title") || "").trim(),
      ariaLabel: (anchor.getAttribute("aria-label") || "").trim(),
    }))
  );

  return dedupeLinks(
    links.map((link) => ({
      text: normalizeText(link.text),
      href: normalizeText(link.href),
      title: normalizeText(link.title),
      ariaLabel: normalizeText(link.ariaLabel),
    }))
  );
}

function pickSliceFolder(links) {
  return (
    pickBestLink(links, (link) => {
      const bundle = linkTextBundle(link).toUpperCase();
      return bundle.includes("SLICES") && isFolderLink(link.href);
    }) ||
    pickBestLink(links, (link) => {
      const bundle = linkTextBundle(link);
      return isFolderLink(link.href) && /slices/i.test(bundle);
    })
  );
}

async function findReferenceJpgLink(page) {
  const candidates = await page
    .locator('a[data-resin-target="openfile"][href*="/file/"], a[href*="/file/"]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        text: (anchor.textContent || "").trim(),
        href: anchor.href || "",
      }))
    );

  return (
    candidates.find(({ text, href }) => {
      return (
        /\/file\//i.test(href) &&
        /\.(?:jpg|jpeg)$/i.test(text) &&
        !/\.psd(?:\s|$)/i.test(text) &&
        !/slice/i.test(text)
      );
    }) || null
  );
}

async function inspectSharedBoxFolder(sharedUrl) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(sharedUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000).catch(() => {});

    const debugLinks = await collectLinks(page);
    const referenceJpgLink = await findReferenceJpgLink(page);

    const referenceJpgName = referenceJpgLink?.text || "";

    const referenceJpgUrl = referenceJpgLink?.href || "";
    const referenceJpgDownloadUrl = referenceJpgLink?.href || "";

    const slicesFolderLink = pickSliceFolder(debugLinks);
    const slicesFolderName = slicesFolderLink?.text || "SLICES";
    const slicesFolderUrl = slicesFolderLink?.href || "";

    let slices = [];

    if (slicesFolderUrl) {
      const slicesPage = await browser.newPage();

      await slicesPage.goto(slicesFolderUrl, { waitUntil: "domcontentloaded" });
      await slicesPage.waitForLoadState("networkidle").catch(() => {});
      await slicesPage.waitForTimeout(2000).catch(() => {});

      const sliceLinks = await collectLinks(slicesPage);

      const seen = new Set();
      slices = sliceLinks
        .filter((link) => isFileLink(link.href))
        .map((link, index) => {
          const pageUrl = link.href;

          return {
            name:
              link.text ||
              link.title ||
              link.ariaLabel ||
              (pageUrl ? pageUrl.split("/").pop() : "") ||
              `slice-${index + 1}`,
            url: pageUrl,
            pageUrl,
            id: null,
          };
        })
        .filter((slice) => {
          if (!slice.url || seen.has(slice.url)) {
            return false;
          }
          seen.add(slice.url);
          return true;
        });

      await slicesPage.close();
    }

    await page.close();

    return {
      folderUrl: sharedUrl,
      referenceJpgName,
      referenceJpgUrl,
      referenceJpgDownloadUrl,
      slicesFolderName,
      slicesFolderUrl,
      slices,
      debugLinks,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  inspectSharedBoxFolder,
};
