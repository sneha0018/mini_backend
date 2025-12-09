const db = require("../db");
const matchController = require("../controllers/matchController"); // FIXED IMPORT

// ADD REQUEST (Recipient creates a request)
exports.addRequest = async (req, res) => {
  try {
    const { item_name, category, quantity, location } = req.body;

    if (!item_name || !category || !quantity || !location) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const recipient_id = req.user.id; // from JWT token

    // Insert request
    const result = await db.query(
      `INSERT INTO requests 
        (recipient_id, item_name, category, quantity, quantity_remaining, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *`,
      [
        recipient_id,
        item_name,
        category,
        quantity,
        quantity, // quantity_remaining initially same as quantity
        location,
      ]
    );

    const newRequest = result.rows[0];

    console.log("DEBUG: New Request Created =", newRequest);

    // AUTO MATCH
    let matchResult = null;
    try {
      if (matchController.runMatchInternal) {
        console.log(
          "DEBUG: Calling runMatchInternal for Request ID:",
          newRequest.id
        );
        matchResult = await matchController.runMatchInternal(newRequest.id);
        console.log("DEBUG: Matching Result =", matchResult);
      } else {
        console.error(
          "ERROR: runMatchInternal is NOT defined in matchController!"
        );
      }
    } catch (err) {
      console.error("AUTO-MATCH FAILED — FULL ERROR:");
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);
    }

    // Return response
    return res.json({
      success: true,
      message: "Request created and matching attempted",
      request: newRequest,
      match: matchResult,
    });
  } catch (err) {
    console.error("Add Request Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET ALL REQUESTS
exports.getAllRequests = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM requests ORDER BY created_at DESC`
    );

    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error("Get All Requests Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET MY REQUESTS
exports.getMyRequests = async (req, res) => {
  try {
    const recipient_id = req.user.id;

    const result = await db.query(
      `SELECT * FROM requests 
       WHERE recipient_id = $1 
       ORDER BY created_at DESC`,
      [recipient_id]
    );

    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error("Get My Requests Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
exports.cancelRequest = async (req, res) => {
  try {
    const request_id = req.params.id;
    const recipient_id = req.user.id;

    // Check request exists & belongs to user
    const reqCheck = await db.query(
      `SELECT * FROM requests WHERE id = $1 AND recipient_id = $2`,
      [request_id, recipient_id]
    );

    if (reqCheck.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const request = reqCheck.rows[0];

    // Allow cancellation only if status = open
    if (request.status !== "open") {
      return res.status(400).json({
        error: "Only OPEN requests can be cancelled.",
      });
    }

    // Update status
    await db.query(`UPDATE requests SET status = 'cancelled' WHERE id = $1`, [
      request_id,
    ]);

    res.json({
      success: true,
      message: "Request cancelled successfully.",
    });
  } catch (err) {
    console.error("Cancel Request Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
