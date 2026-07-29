const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST || "0.0.0.0";
const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
