const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const { loginUser } = require("../controllers/authController");

// LOGIN ROUTE
router.post("/login", loginUser);

// REGISTER ROUTE
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, location } = req.body;

    if (!name || !email || !password || !role || !location) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user (PostgreSQL syntax)
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, location)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, hashedPassword, role, location]
    );

    res.json({ success: true, message: "User registered successfully!" });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
