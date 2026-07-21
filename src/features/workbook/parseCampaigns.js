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


function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";


  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;


  return text;
}


function normalize(value) {
  return String(value || "").trim().toUpperCase();
}


const ITEM_LABEL_FIELDS = {
  IMAGE: "image",
  "PRODUCT STORY/COLLECTION": "product",
  "PRODUCT STORY": "product",
  "PRODUCT STORY / COLLECTION": "product",
  PRODUCT: "product",
  CTA: "cta",
  LINK: "link",
};


function findItemField(row, searchLimit = 6) {
  for (let i = 0; i < Math.min(row.length, searchLimit); i++) {
    const field = ITEM_LABEL_FIELDS[normalize(row[i])];
    if (field) {
      return { field, labelIndex: i };
    }
  }
  return null;
}


function createEmptyItem() {
  return {
    image: "",
    product: "",
    cta: "",
    link: "",
  };
}


function itemHasContent(item) {
  return Boolean(item?.image || item?.product || item?.cta || item?.link);
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
          slices: [],
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
      let currentItem = null;


      while (j < rows.length) {
        const currentRow = rows[j];


        if (j !== i && normalize(getCell(currentRow, 0)) === "SEND DATE") {
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
          if (itemHasContent(currentItem)) {
            campaign.workbook.items.push(currentItem);
            currentItem = null;
          }

          campaign.workbook.notes = currentRow
            .slice(1)
            .map((cell) => String(cell || "").trim())
            .filter(Boolean)
            .join(" ");
        }


        const itemField = findItemField(currentRow);


        if (itemField) {
          const { field, labelIndex } = itemField;
          const startsNextItem =
            itemHasContent(currentItem) &&
            (field === "image" ||
              Boolean(currentItem[field]) ||
              Boolean(currentItem.link));

          if (startsNextItem) {
            campaign.workbook.items.push(currentItem);
            currentItem = null;
          }

          if (!currentItem) currentItem = createEmptyItem();

          const value = getCell(currentRow, labelIndex + 1);
          currentItem[field] = field === "link" ? normalizeUrl(value) : value;
        }


        j++;
      }


      if (itemHasContent(currentItem)) {
        campaign.workbook.items.push(currentItem);
      }


      const details = extractDetailsFromNotes(campaign.workbook.notes);


      campaign.workzone.subjectLine = details.subjectLine;
      campaign.box.folderUrl = details.boxFolder;


      campaigns.push(campaign);
    }
  }


  return campaigns;
}

