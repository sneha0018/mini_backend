const express = require("express");
const router = express.Router();
const db = require("../db");

const {
  verifyToken,
  requireDonor,
  requireAdmin,
} = require("../middleware/authMiddleware");

// ADD DONATION (DONOR)
router.post("/add", verifyToken, requireDonor, async (req, res) => {
  try {
    const donorId = req.user.id;
    const { item_name, category, quantity, location } = req.body;

    const result = await db.query(
      `INSERT INTO donations (
        donor_id, item_name, category, quantity,
        quantity_available, quantity_remaining,
        location, status
      )
      VALUES ($1, $2, $3, $4, $4, $4, $5, 'available')
      RETURNING *`,
      [donorId, item_name, category, quantity, location]
    );

    res.json({ success: true, donation: result.rows[0] });
  } catch (err) {
    console.error("Add Donation Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DONOR — GET MY OWN DONATIONS
router.get("/my", verifyToken, requireDonor, async (req, res) => {
  try {
    const donorId = req.user.id;

    const result = await db.query(
      "SELECT * FROM donations WHERE donor_id = $1 ORDER BY id DESC",
      [donorId]
    );

    res.json({ success: true, donations: result.rows });
  } catch (err) {
    console.error("Get My Donations Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN — GET ALL DONATIONS (IMPORTANT!)
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM donations ORDER BY created_at DESC`
    );

    res.json({ success: true, donations: result.rows });
  } catch (err) {
    console.error("Admin Get All Donations Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET A SINGLE DONATION (DONOR ONLY)
router.get("/:id", verifyToken, requireDonor, async (req, res) => {
  try {
    const donorId = req.user.id;
    const donationId = req.params.id;

    const result = await db.query(
      "SELECT * FROM donations WHERE id = $1 AND donor_id = $2",
      [donationId, donorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Donation not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get Single Donation Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE DONATION
router.put("/:id", verifyToken, requireDonor, async (req, res) => {
  try {
    const donorId = req.user.id;
    const donationId = req.params.id;
    const { item_name, category, quantity } = req.body;

    const check = await db.query(
      "SELECT * FROM donations WHERE id = $1 AND donor_id = $2",
      [donationId, donorId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const result = await db.query(
      `UPDATE donations 
       SET item_name=$1, category=$2, quantity=$3 
       WHERE id=$4 RETURNING *`,
      [item_name, category, quantity, donationId]
    );

    res.json({ success: true, donation: result.rows[0] });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE DONATION
router.delete("/:id", verifyToken, requireDonor, async (req, res) => {
  try {
    const donorId = req.user.id;
    const donationId = req.params.id;

    const check = await db.query(
      "SELECT * FROM donations WHERE id = $1 AND donor_id = $2",
      [donationId, donorId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await db.query("DELETE FROM donations WHERE id=$1", [donationId]);

    res.json({ success: true, message: "Donation deleted" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
