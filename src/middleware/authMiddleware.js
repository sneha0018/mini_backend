const jwt = require("jsonwebtoken");

// Verify Token
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });

    req.user = decoded; // { id, email, role }
    next();
  });
};

// donor only
exports.requireDonor = (req, res, next) => {
  if (req.user.role !== "donor")
    return res.status(403).json({ error: "Only donors allowed" });
  next();
};

// recipient only
exports.requireRecipient = (req, res, next) => {
  if (req.user.role !== "recipient")
    return res.status(403).json({ error: "Only recipients allowed" });
  next();
};

// admin or donor
exports.requireAdminOrDonor = (req, res, next) => {
  if (req.user.role === "admin" || req.user.role === "donor") {
    return next();
  }
  return res.status(403).json({ error: "Only admin or donor allowed" });
};

// admin only
exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
};
