const db = require("../db");

exports.addDonation = async (req, res) => {
  try {
    const { item_name, category, quantity, location } = req.body;

    if (!item_name || !category || !quantity || !location) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const donor_id = req.user.id; // from JWT token

    const result = await db.query(
      `INSERT INTO donations (donor_id, item_name, category, quantity, quantity_available, location)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING *`,
      [donor_id, item_name, category, quantity, location]
    );

    res.json({ success: true, donation: result.rows[0] });
  } catch (err) {
    console.error("Add Donation Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllDonations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM donations ORDER BY created_at DESC`
    );
    res.json({ success: true, donations: result.rows });
  } catch (err) {
    console.error("Get Donations Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
exports.getAllDonations = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM donations ORDER BY created_at DESC"
    );
    res.json({ success: true, donations: result.rows });
  } catch (err) {
    console.error("Get Donations Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
exports.getMyDonations = async (req, res) => {
  try {
    const donor_id = req.user.id;

    const result = await db.query(
      `SELECT * FROM donations WHERE donor_id = $1 ORDER BY created_at DESC`,
      [donor_id]
    );

    res.json({ success: true, donations: result.rows });
  } catch (err) {
    console.error("Get Donation History Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
