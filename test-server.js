const express = require("express");
const app = express();

app.get("/test", (req, res) => {
  console.log("Test endpoint called");
  res.json({ status: "ok" });
});

app.listen(3001, () => {
  console.log("Test server running at port 3001");
});
