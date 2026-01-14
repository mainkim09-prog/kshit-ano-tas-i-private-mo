const { login } = require("biar-fca");
const fs = require("fs");
const path = require("path");
const express = require("express");

/* ======================
   EXPRESS UPTIME SERVER
====================== */
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Bot is running.");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Uptime server running on port ${port}`);
});

/* ======================
   LOAD APPSTATE
====================== */
let appState;
try {
  appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch {
  console.error("Invalid or missing appstate.json");
  process.exit(1);
}

/* ======================
   LOAD CONFIG + ADMINS
====================== */
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const admins = (config.admins || []).map(String);

/* ======================
   COMMAND SYSTEM
====================== */
const commands = new Map();
const trollMode = new Map();
const targetTrollMode = new Map();
global.heyTimers = new Map();

const trollMessages = require("./trollMessages").messages;

const commandFiles = fs
  .readdirSync(path.join(__dirname, "commands"))
  .filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  commands.set(cmd.name, cmd);
}

/* ======================
   LOGIN
====================== */
login({ appState }, (err, api) => {
  if (err) return console.error(err);

  console.log("Logged in successfully!");

  api.setOptions({
    listenEvents: true,
    selfListen: true,
    online: true
  });

  const BOT_ID = String(api.getCurrentUserID());

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (
      event.type !== "message" &&
      event.type !== "message_reply"
    ) return;

    const threadID = event.threadID;
    const senderID = String(event.senderID);
    const body = (event.body || "").trim();

    if (!body) return;

    /* ======================
       AUTO REACT TO SELF
    ====================== */
    if (
      senderID === BOT_ID &&
      !body.startsWith(".") &&
      !body.startsWith("/")
    ) {
      api.setMessageReaction("😆", event.messageID, threadID);
      return; // stop here to avoid loops
    }

    /* ======================
       SELF COMMAND ALLOWED
    ====================== */
    if (
      senderID === BOT_ID &&
      !body.startsWith(".") &&
      !body.startsWith("/")
    ) {
      return;
    }

    /* ======================
       ADMIN CHECK
    ====================== */
    if (!admins.includes(senderID)) return;

    /* ======================
       COMMAND PARSE
    ====================== */
    const args = body.split(/\s+/);
    const cmdName = args.shift().toLowerCase().replace(/^[./]/, "");

    if (!commands.has(cmdName)) return;

    console.log(`Command: ${cmdName} by ${senderID}`);

    try {
      commands.get(cmdName).execute(
        api,
        event,
        args,
        { trollMode, targetTrollMode }
      );
    } catch (e) {
      console.error(`Command error (${cmdName}):`, e);
    }
  });
});
