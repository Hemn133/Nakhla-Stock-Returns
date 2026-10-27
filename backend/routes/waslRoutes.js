const express = require("express");
const waslController = require("../controllers/waslController");
const waslReturnController = require("../controllers/waslReturnController");

const router = express.Router();

router.post("/", waslController.createWasl);

router.get("/", waslController.getWasls);

router.get("/reports/summary", waslController.getWaslSummary);
router.get("/reports/today", waslController.getTodayWasls);
router.get("/reports/by-date", waslController.getWaslsByDate);
router.get("/reports/top-products", waslController.getTopSellingProducts);

router.get("/:id", waslController.getWaslById);

// Product returns of one wasl
router.get("/:id/returns", waslReturnController.getReturns);
router.post("/:id/returns", waslReturnController.createReturn);
router.delete("/:id", waslController.deleteWasl);

module.exports = router;
