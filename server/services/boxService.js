const { chromium } = require("playwright");
const { parseBoxSharedUrl } = require("./boxUrlService");

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

function isSupportedImageName(name) {
  return /\.(?:jpe?g|png|gif|webp)$/i.test(name || "") && !/\.psd$/i.test(name);
}

function isReferenceJpgName(name) {
  return (
    /\.(?:jpg|jpeg)$/i.test(name || "") &&
    !/\.psd(?:\s|$)/i.test(name || "") &&
    !/slice/i.test(name || "")
  );
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

  if (rowMatch && isReferenceJpgName(rowMatch.text)) return rowMatch;

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
        isReferenceJpgName(text)
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
  try {
    await page
      .locator('[role="row"][data-resin-file_id] a[href*="/file/"]')
      .first()
      .waitFor({ state: "attached", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function collectFileRows(page) {
  return page
    .locator('[role="row"][data-resin-file_id]')
    .evaluateAll((rows) =>
      rows
        .map((row) => {
          const nameElement = row.querySelector(
            '.item-list-name[data-testid]'
          );
          const anchors = Array.from(
            row.querySelectorAll('a[href*="/file/"]')
          );
          const filenameCandidates = [
            nameElement?.getAttribute("data-testid") || "",
            nameElement?.textContent || "",
            ...anchors.map((anchor) => anchor.textContent || ""),
          ].map((value) => value.trim());
          const name = filenameCandidates.find(Boolean) || "";
          const anchor =
            anchors.find(
              (candidate) =>
                (candidate.textContent || "").trim() === name
            ) || anchors[0];

          if (!anchor?.href) return null;

          return {
            text: name,
            href: anchor.href,
            title: "",
            ariaLabel: "",
          };
        })
        .filter(Boolean)
    );
}

async function inspectSharedBoxFolder(sharedUrl) {
  const sharedFolder = parseBoxSharedUrl(sharedUrl, "folder");
  sharedUrl = sharedFolder.url;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(sharedUrl, { waitUntil: "domcontentloaded" });

    const referenceJpgLink = await findReferenceJpgLink(page);
    await waitForSlicesFolderLink(page);
    const debugLinks = await collectLinks(page);

    const referenceFile = referenceJpgLink?.href
      ? parseBoxSharedUrl(referenceJpgLink.href, "file")
      : null;
    const referenceJpgName = referenceJpgLink?.text || "";
    const referenceJpgUrl =
      referenceFile?.shareToken === sharedFolder.shareToken
        ? referenceFile.url
        : "";

    const slicesFolderLink = pickSliceFolder(debugLinks);
    const slicesFolderName = slicesFolderLink?.text || "SLICES";
    const parsedSlicesFolder = slicesFolderLink?.href
      ? parseBoxSharedUrl(slicesFolderLink.href, "folder")
      : null;
    const slicesFolderUrl =
      parsedSlicesFolder?.shareToken === sharedFolder.shareToken
        ? parsedSlicesFolder.url
        : "";

    let slices = [];

    if (slicesFolderUrl) {
      let sliceLinks = [];

      for (let attempt = 1; attempt <= 2 && sliceLinks.length === 0; attempt += 1) {
        const slicesPage = await browser.newPage();

        try {
          await slicesPage.goto(slicesFolderUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
          await waitForFileRows(slicesPage);
          sliceLinks = await collectFileRows(slicesPage);
        } finally {
          await slicesPage.close();
        }
      }

      if (sliceLinks.length === 0) {
        throw new Error(
          "The SLICES folder was found, but its file rows did not load. Try loading the Box assets again."
        );
      }

      const seen = new Set();
      slices = sliceLinks
        .filter(
          (link) => isFileLink(link.href) && isSupportedImageName(link.text)
        )
        .map((link, index) => {
          const parsedFile = parseBoxSharedUrl(link.href, "file");
          if (parsedFile.shareToken !== sharedFolder.shareToken) return null;
          const pageUrl = parsedFile.url;

          return {
            name:
              link.text ||
              link.title ||
              link.ariaLabel ||
              (pageUrl ? pageUrl.split("/").pop() : "") ||
              `slice-${index + 1}`,
            url: pageUrl,
            pageUrl,
            downloadUrl: pageUrl,
            id: parsedFile.itemId ? Number(parsedFile.itemId) : null,
          };
        })
        .filter((slice) => {
          if (!slice?.url || seen.has(slice.url)) {
            return false;
          }
          seen.add(slice.url);
          return true;
        });
    }

    await page.close();

    return {
      folderUrl: sharedUrl,
      referenceJpgName,
      referenceJpgUrl,
      referenceJpgDownloadUrl: referenceJpgUrl,
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
  isReferenceJpgName,
  isSupportedImageName,
};
