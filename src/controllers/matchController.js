const db = require("../db");

/**
 * Simple offline distance heuristic (no external API)
 * Returns a numeric distance score (smaller = closer)
 * - exact match (case-insensitive) => 0
 * - one string includes the other => 1
 * - token overlap (words in common) => 2
 * - otherwise => 100
 *
 * This is deterministic, free, and works well for a college project.
 */
function computeLocationScore(locA, locB) {
  if (!locA || !locB) return 100;
  const a = locA.trim().toLowerCase();
  const b = locB.trim().toLowerCase();

  if (a === b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;

  // token overlap
  const tokensA = new Set(a.split(/[\s,.-]+/));
  const tokensB = new Set(b.split(/[\s,.-]+/));
  let common = 0;
  tokensA.forEach((t) => {
    if (t && tokensB.has(t)) common++;
  });
  if (common > 0) return 2;

  return 100; // far
}

/**
 * Internal matching function that can be called from other controllers.
 * Accepts requestId and performs matching allocation (category + nearest donor).
 * Returns an object with created matches and remaining_needed.
 */
async function runMatchInternal(requestId) {
  // validate
  if (!requestId) throw new Error("requestId required");

  // 1. Get the request
  const reqRes = await db.query("SELECT * FROM requests WHERE id = $1", [
    requestId,
  ]);
  if (reqRes.rows.length === 0) {
    throw new Error("Request not found");
  }
  const request = reqRes.rows[0];

  // If already fulfilled, nothing to do
  if (request.status === "fulfilled") {
    return {
      message: "Request already fulfilled",
      matches: [],
      remaining_needed: 0,
    };
  }

  // 2. Fetch candidate donations (same category, quantity_remaining > 0, status available)
  const donationsRes = await db.query(
    `SELECT * FROM donations
     WHERE category = $1 AND quantity_remaining > 0
       AND status = 'available'`,
    [request.category]
  );
  const donations = donationsRes.rows;
  if (!donations || donations.length === 0) {
    return {
      message: "No matching donations found",
      matches: [],
      remaining_needed: request.quantity,
    };
  }

  // 3. Compute distance score for each donation (using offline heuristic)
  const donationsWithScore = donations.map((d) => {
    const score = computeLocationScore(
      (request.location || "").toString(),
      (d.location || "").toString()
    );
    return { ...d, distance_score: score };
  });

  // 4. Sort by best (smallest) score then by earliest created_at
  donationsWithScore.sort((a, b) => {
    if (a.distance_score !== b.distance_score)
      return a.distance_score - b.distance_score;
    // fallback to created_at ascending if available
    if (a.created_at && b.created_at) {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0;
  });

  // 5. Allocate from nearest donors until request fulfilled or donors exhausted
  let remainingNeeded = parseInt(
    request.quantity_remaining ?? request.quantity,
    10
  );
  if (isNaN(remainingNeeded)) remainingNeeded = parseInt(request.quantity, 10);

  const createdMatches = [];

  for (const don of donationsWithScore) {
    if (remainingNeeded <= 0) break;

    const available = parseInt(don.quantity_remaining, 10);
    if (isNaN(available) || available <= 0) continue;

    const alloc = Math.min(available, remainingNeeded);

    // update donation
    await db.query(
      `UPDATE donations SET quantity_remaining = quantity_remaining - $1
       WHERE id = $2`,
      [alloc, don.id]
    );

    // insert match record
    const matchRes = await db.query(
      `INSERT INTO matches (donation_id, request_id, allocated_quantity, status, distance_score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        don.id,
        request.id,
        alloc,
        alloc === remainingNeeded ? "fulfilled" : "partial",
        don.distance_score,
      ]
    );

    createdMatches.push(matchRes.rows[0]);

    remainingNeeded -= alloc;
  }

  // 6. Update request status and quantity_remaining
  const newStatus =
    remainingNeeded <= 0
      ? "fulfilled"
      : createdMatches.length > 0
      ? "partial"
      : "waiting";
  await db.query(
    `UPDATE requests SET status = $1, quantity_remaining = $2 WHERE id = $3`,
    [newStatus, Math.max(0, remainingNeeded), request.id]
  );

  return {
    success: true,
    message: "Matching executed",
    request_id: request.id,
    status: newStatus,
    matches: createdMatches,
    remaining_needed: remainingNeeded,
  };
}

// Route handler: run match via POST /match/run
exports.runMatch = async (req, res) => {
  try {
    const { request_id } = req.body;
    if (!request_id)
      return res.status(400).json({ error: "request_id required" });

    const result = await runMatchInternal(request_id);
    return res.json(result);
  } catch (err) {
    console.error("Match Error:", err.message || err);
    return res
      .status(500)
      .json({ error: "Matching failed", details: err.message });
  }
};

// Export internal function so other controllers (e.g., requests controller) can auto-trigger matching
exports.runMatchInternal = runMatchInternal;

// ADMIN: GET ALL MATCHES (keeps your existing behavior and adds distance_score)
exports.getAllMatches = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        m.id AS match_id,
        m.allocated_quantity,
        m.status,
        m.created_at,
        m.distance_score,
        d.item_name AS donation_item,
        d.category AS donation_category,
        d.donor_id,
        r.item_name AS request_item,
        r.recipient_id
      FROM matches m
      JOIN donations d ON m.donation_id = d.id
      JOIN requests r ON m.request_id = r.id
      ORDER BY m.created_at DESC
    `);

    res.json({ success: true, matches: result.rows });
  } catch (err) {
    console.error("Get All Matches Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET MATCHES FOR LOGGED-IN RECIPIENT
exports.getMyMatches = async (req, res) => {
  try {
    const recipient_id = req.user.id;

    const result = await db.query(
      `
      SELECT 
        m.id AS match_id,
        m.allocated_quantity,
        m.status AS match_status,
        m.created_at,

        r.item_name AS request_item,
        r.quantity AS request_quantity,
        r.quantity_remaining AS request_remaining,

        d.item_name AS donation_item,
        d.category,
        d.donor_id
      FROM matches m
      JOIN requests r ON m.request_id = r.id
      JOIN donations d ON m.donation_id = d.id
      WHERE r.recipient_id = $1
      ORDER BY m.created_at DESC
      `,
      [recipient_id]
    );

    res.json({ success: true, matches: result.rows });
  } catch (err) {
    console.error("Get My Matches Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
