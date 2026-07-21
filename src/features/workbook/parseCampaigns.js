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


function rowHasLabel(row, label, searchLimit = 6) {
  for (let i = 0; i < Math.min(row.length, searchLimit); i++) {
    if (normalize(row[i]) === label) {
      return i;
    }
  }
  return -1;
}


function rowHasAnyLabel(row, labels, searchLimit = 6) {
  for (let i = 0; i < Math.min(row.length, searchLimit); i++) {
    const cell = normalize(row[i]);
    if (labels.includes(cell)) {
      return i;
    }
  }
  return -1;
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
          campaign.workbook.notes = currentRow
            .slice(1)
            .map((cell) => String(cell || "").trim())
            .filter(Boolean)
            .join(" ");
        }


        const imageIndex = rowHasLabel(currentRow, "IMAGE");


        if (imageIndex !== -1) {
          const item = {
            image: getCell(currentRow, imageIndex + 1),
            product: "",
            cta: "",
            link: "",
          };


          let k = j + 1;


          while (k < rows.length) {
            const nextRow = rows[k] || [];


            const nextImageIndex = rowHasLabel(nextRow, "IMAGE");
            const nextLabel = rowHasAnyLabel(nextRow, [
              "PRODUCT STORY/COLLECTION",
              "PRODUCT STORY",
              "PRODUCT STORY / COLLECTION",
              "PRODUCT",
              "CTA",
              "LINK",
              "SEND DATE",
              "WORKZONE NOTES",
              "MERCHANT REVIEW",
            ]);


            if (nextImageIndex !== -1) {
              break;
            }


            if (normalize(getCell(nextRow, 0)) === "SEND DATE") {
              break;
            }


            if (nextLabel !== -1) {
              const cellLabel = normalize(nextRow[nextLabel]);


              if (
                cellLabel === "PRODUCT STORY/COLLECTION" ||
                cellLabel === "PRODUCT STORY" ||
                cellLabel === "PRODUCT STORY / COLLECTION" ||
                cellLabel === "PRODUCT"
              ) {
                item.product = getCell(nextRow, nextLabel + 1);
              } else if (cellLabel === "CTA") {
                item.cta = getCell(nextRow, nextLabel + 1);
              } else if (cellLabel === "LINK") {
                item.link = normalizeUrl(getCell(nextRow, nextLabel + 1));
              } else if (
                cellLabel.includes("WORKZONE NOTES") ||
                cellLabel === "MERCHANT REVIEW"
              ) {
                break;
              }
            }


            k++;
          }


          campaign.workbook.items.push(item);
          j = k - 1;
        }


        j++;
      }


      const details = extractDetailsFromNotes(campaign.workbook.notes);


      campaign.workzone.subjectLine = details.subjectLine;
      campaign.box.folderUrl = details.boxFolder;


      campaigns.push(campaign);
    }
  }


  return campaigns;
}


