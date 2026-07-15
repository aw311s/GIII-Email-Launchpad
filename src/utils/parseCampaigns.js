function getCell(row, index) {
  const value = row[index];

  if (!value) return "";

  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }

  return String(value).trim();
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function extractDetailsFromNotes(notes) {
  const details = {
    subjectLine: "",
    boxFolder: "",
  };

  if (!notes) return details;

  const subjectMatch = notes.match(/subject line[:\s]+(.+)/i);
  const boxMatch = notes.match(/https?:\/\/[^\s]*box[^\s]*/i);

  if (subjectMatch) {
    details.subjectLine = subjectMatch[1].trim();
  }

  if (boxMatch) {
    details.boxFolder = boxMatch[0].trim();
  }

  return details;
}

export function parseCampaigns(rows) {
  const campaigns = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (normalize(getCell(row, 0)) === "SEND DATE") {
      const campaign = {
        workbook: {
          wzDate: getCell(row, 1),
          sendDate: "",
          keyMessage: "",
          messageType: "",
          brief: "",
          notes: "",
          items: [],
        },

        workzone: {
          projectName: "",
          projectUrl: "",
          subjectLine: "",
          preheader: "",
        },

        box: {
          folderUrl: "",
          referenceJpgName: "",
          referenceJpgUrl: "",
          slicesFolderName: "",
          slicesFolderUrl: "",
        },

        klaviyo: {
          templateName: "",
          campaignId: "",
          uploadedImages: [],
        },

        status: {
          workbook: true,
          workzone: false,
          box: false,
          klaviyo: false,
        },
      };

      let j = i + 1;

      while (j < rows.length) {
        const currentRow = rows[j];

        if (
          j !== i &&
          normalize(getCell(currentRow, 0)) === "SEND DATE"
        ) {
          break;
        }

        const label = normalize(getCell(currentRow, 0));

        if (label === "KEY MESSAGE") {
          campaign.workbook.keyMessage = getCell(currentRow, 1);
        }

        if (label === "MESSAGE TYPE") {
          campaign.workbook.messageType = getCell(currentRow, 1);
        }

        if (label === "BRIEF") {
          campaign.workbook.brief = getCell(currentRow, 1);
        }

        if (label.includes("WORKZONE NOTES")) {
          campaign.workbook.notes = getCell(currentRow, 1);
        }

        const imageIndex = currentRow.findIndex(
          (cell) => normalize(cell) === "IMAGE"
        );

        if (imageIndex !== -1) {
          const productRow = rows[j + 1] || [];
          const ctaRow = rows[j + 2] || [];
          const linkRow = rows[j + 3] || [];

          campaign.workbook.items.push({
            image: getCell(currentRow, imageIndex + 1),
            product: getCell(productRow, imageIndex + 1),
            cta: getCell(ctaRow, imageIndex + 1),
            link: getCell(linkRow, imageIndex + 1),
          });
        }

        j++;
      }

      const details = extractDetailsFromNotes(
        campaign.workbook.notes
      );

      campaign.workzone.subjectLine = details.subjectLine;
      campaign.box.folderUrl = details.boxFolder;

      campaigns.push(campaign);
    }
  }

  return campaigns;
}

