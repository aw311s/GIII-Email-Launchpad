const { chromium } = require("playwright");

function dedupeLinks(links) {
  const byHref = new Map();

  for (const link of links) {
    if (!link.href) continue;

    const existing = byHref.get(link.href);
    const existingMetadataLength = existing
      ? `${existing.text}${existing.title}${existing.ariaLabel}`.length
      : -1;
    const metadataLength = `${link.text}${link.title}${link.ariaLabel}`.length;

    if (!existing || metadataLength > existingMetadataLength) {
      byHref.set(link.href, link);
    }
  }

  return Array.from(byHref.values());
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
  await page
    .locator('[role="row"] .item-list-name[data-testid]')
    .filter({ hasText: /\.(?:jpg|jpeg)$/i })
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});

  const rowMatch = await page
    .locator('[role="row"][data-resin-file_id]')
    .evaluateAll((rows) => {
      for (const row of rows) {
        const nameElement = row.querySelector(
          '.item-list-name[data-testid]'
        );
        const filenameCandidates = [
          nameElement?.getAttribute("data-testid") || "",
          nameElement?.textContent || "",
        ].map((value) => value.trim());

        const filename = filenameCandidates.find(
          (value) =>
            /\.(?:jpg|jpeg)$/i.test(value) &&
            !/\.psd(?:\s|$)/i.test(value) &&
            !/slice/i.test(value)
        );

        if (!filename) continue;

        const fileAnchors = Array.from(
          row.querySelectorAll(
            'a[data-resin-target="openfile"][href*="/file/"], a[href*="/file/"]'
          )
        );
        const anchor =
          fileAnchors.find(
            (candidate) =>
              (candidate.textContent || "").trim() === filename
          ) || fileAnchors[0];

        if (!anchor?.href) continue;

        return {
          text: filename,
          href: anchor.href,
        };
      }

      return null;
    });

  if (rowMatch) return rowMatch;

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

async function waitForSlicesFolderLink(page) {
  await page
    .locator('a[href*="/folder/"]')
    .filter({ hasText: /slices/i })
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});
}

async function waitForFileRows(page) {
  await page
    .locator('[role="row"][data-resin-file_id] a[href*="/file/"]')
    .first()
    .waitFor({ state: "attached", timeout: 10000 })
    .catch(() => {});
}

async function inspectSharedBoxFolder(sharedUrl) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(sharedUrl, { waitUntil: "domcontentloaded" });

    const referenceJpgLink = await findReferenceJpgLink(page);
    await waitForSlicesFolderLink(page);
    const debugLinks = await collectLinks(page);

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
      await waitForFileRows(slicesPage);

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
