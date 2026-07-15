const express = require("express");
const router = express.Router();
const boxService = require("../services/boxService");

router.get("/inspect", async (req, res) => {
  try {
    const { url } = req.query;
    const assets = await boxService.inspectSharedBoxFolder(url);

    res.json({
        success: true,
        assets,
    });
  }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

module.exports = router;
