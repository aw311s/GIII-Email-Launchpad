const express = require("express");


const router = express.Router();


router.get("/status", (req, res) => {
  const configured =
    Boolean(process.env.MICROSOFT_TENANT_ID) &&
    Boolean(process.env.MICROSOFT_CLIENT_ID);


  res.json({
    connected: false,
    configured,
    message: configured
      ? "SharePoint configuration is present"
      : "SharePoint configuration is not available yet",
  });
});


module.exports = router;





