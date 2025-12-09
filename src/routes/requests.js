const express = require("express");
const router = express.Router();

const {
  addRequest,
  getAllRequests,
  getMyRequests,
  cancelRequest,
} = require("../controllers/requestController");

const {
  verifyToken,
  requireRecipient,
} = require("../middleware/authMiddleware");

// Only recipients can add requests
router.post("/add", verifyToken, requireRecipient, addRequest);

// Recipient sees only their requests
router.get("/my", verifyToken, requireRecipient, getMyRequests);

// Recipient cancels their request
router.put("/cancel/:id", verifyToken, requireRecipient, cancelRequest);

// Everyone can view all requests
router.get("/", getAllRequests);

module.exports = router;
