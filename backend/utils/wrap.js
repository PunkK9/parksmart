// Wraps async route handlers so a thrown error becomes a JSON 500 instead of a crash.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error(e);
    res.status(500).json({ message: e.message || "Server error" });
  });
