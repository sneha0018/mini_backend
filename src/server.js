const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors()); // <--- VERY IMPORTANT
app.use(express.json());

// all routes below
const authRoutes = require("./routes/auth");
const donationRoutes = require("./routes/donations");
const requestRoutes = require("./routes/requests");
const matchRoutes = require("./routes/matches");

app.use("/auth", authRoutes);
app.use("/donations", donationRoutes);
app.use("/requests", requestRoutes);
app.use("/matches", matchRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));
