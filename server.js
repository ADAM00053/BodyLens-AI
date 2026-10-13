
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.disable("x-powered-by");

app.use(express.static(__dirname, {
  index: "index.html"
}));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`BodyLens AI يعمل على http://localhost:${PORT}`);
});
