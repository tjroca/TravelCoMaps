const express = require("express");
const schedule = require("node-schedule");
const travelCo = require("./travelCo.js");

const app = express();

// (async () => {
//     await travelCo();
// })();

let j = schedule.scheduleJob('0 0 0 * * *', async () => {
    // Run at 00:00 every day
    await travelCo();
});


app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://notion.so");
    next();
});

app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", "./views");

app.get("/", (req, res) => {
    res.render("index", {

    });
});

app.listen(4444);