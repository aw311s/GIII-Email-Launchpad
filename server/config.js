module.exports = {
    workzone: {
        clientId:
            process.env.WORKZONE_CLIENT_ID || process.env.WORKZONE_CLIENTID,
        clientSecret: process.env.WORKZONE_CLIENT_SECRET,
        tokenUrl: process.env.WORKZONE_TOKEN_URL,
        apiBaseUrl: process.env.WORKZONE_API_BASE_URL,
    },
    sharepoint: {
        tenantId: process.env.MICROSOFT_TENANT_ID,
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        siteId: process.env.SHAREPOINT_SITE_ID,
        driveId: process.env.SHAREPOINT_DRIVE_ID,
        workbookPaths: {
            dkny: process.env.SHAREPOINT_WORKBOOK_PATH_DKNY,
            "karl-lagerfeld": process.env.SHAREPOINT_WORKBOOK_PATH_KARL,
            "donna-karan": process.env.SHAREPOINT_WORKBOOK_PATH_DONNA,
        },
    },
};
