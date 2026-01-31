const express = require("express");
const cors = require("cors");
const app = express();
const portNum = 3001;

app.use(cors()); 
app.use(express.json()); // parse JSON body

app.use("/api/homeAdmin", require("./routes/adminHome"));

app.listen(portNum, () => {
    console.log(`Backend running on http://localhost:${portNum}`);
});
