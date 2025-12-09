const express = require("express");
const router = express.Router();

const { runMatch, getAllMatches } = require("../controllers/matchController");
const {
  verifyToken,
  requireAdminOrDonor,
  requireAdmin,
} = require("../middleware/authMiddleware");
const { getMyMatches } = require("../controllers/matchController");

// Recipient can view their match history
router.get("/my", verifyToken, getMyMatches);

// Donor or Admin can run match
router.post("/run", verifyToken, requireAdminOrDonor, runMatch);

// Admin can view all matches
router.get("/all", verifyToken, requireAdmin, getAllMatches);

module.exports = router;
