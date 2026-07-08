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
    dropboxFolder: "",
  };

  if (!notes) return details;

  const subjectMatch = notes.match(/subject line[:\s]+(.+)/i);
  const dropboxMatch = notes.match(/https?:\/\/[^\s]*dropbox[^\s]*/i);

  if (subjectMatch) {
    details.subjectLine = subjectMatch[1].trim();
  }

  if (dropboxMatch) {
    details.dropboxFolder = dropboxMatch[0].trim();
  }

  return details;
}



export function parseCampaigns(rows) {
  const campaigns = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (normalize(getCell(row, 0)) === "SEND DATE") {
      const campaign = {
        wzDate: getCell(row, 1),
        sendDate: "",
        subjectLine: "",
        preheader: "",
        boxLink: "",

        keyMessage: "",
        messageType: "",
        brief: "",

        items: [],
        notes: "",

        //Dropbox Folder
        dropboxFolder: "",
        referenceImage: "",
        slices: [],

        //Workzone Project
        workzoneProject: "",
        projectURL: "",

        //Klaviyo Images
        uploadedImages: [],

        status: {
          workbook: true,
          workzone: false,
          box: false,
          klaviyo: false,
        }
      };

      let j = i + 1;

      while (j < rows.length) {
        const currentRow = rows[j];

        if (j !== i && normalize(getCell(currentRow, 0)) === "SEND DATE") {
          break;
        }

        const label = normalize(getCell(currentRow, 0));

        if (label === "KEY MESSAGE") {
          campaign.keyMessage = getCell(currentRow, 1);
        }

        if (label === "MESSAGE TYPE") {
          campaign.messageType = getCell(currentRow, 1);
        }

        if (label === "BRIEF") {
          campaign.brief = getCell(currentRow, 1);
        }

        if (label.includes("WORKZONE NOTES")) {
          campaign.notes = getCell(currentRow, 1);
        }

        const imageIndex = currentRow.findIndex(
          (cell) => normalize(cell) === "IMAGE"
        );

        if (imageIndex !== -1) {
          const productRow = rows[j + 1] || [];
          const ctaRow = rows[j + 2] || [];
          const linkRow = rows[j + 3] || [];

          campaign.items.push({
            image: getCell(currentRow, imageIndex + 1),
            product: getCell(productRow, imageIndex + 1),
            cta: getCell(ctaRow, imageIndex + 1),
            link: getCell(linkRow, imageIndex + 1),
          });
        }

        j++;
      }
    
      const extractDetails = extractDetailsFromNotes(campaign.notes);
      campaign.subjectLine = extractDetails.subjectLine;
      campaign.dropboxFolder = extractDetails.dropboxFolder;
      campaigns.push(campaign);
    }
  }

  return campaigns;
}
