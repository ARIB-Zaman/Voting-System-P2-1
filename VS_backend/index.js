const express = require("express");
const cors = require("cors");
const app = express();
const portNum = 3001;

app.use(cors()); 
app.use(express.json()); // parse JSON body

app.use("/api/election", require("./routes/adminHome"));
app.use("/api/users", require("./routes/users"));
app.use("/api/constituency", require("./routes/constituency"));

app.listen(portNum, () => {
    console.log(`Backend running on http://localhost:${portNum}`);
});
