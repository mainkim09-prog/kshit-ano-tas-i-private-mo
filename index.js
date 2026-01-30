const { login } = require("biar-fca");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const port = 5000;

/* ================== UPTIME ================== */
app.get("/", (req, res) => {
    res.send("Bot is Online");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Uptime server running on port ${port}`);
});

/* ================== LOAD APPSTATE ================== */
let appState;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (err) {
    console.error("Error reading appstate.json.");
    process.exit(1);
}

/* ================== LOAD CONFIG ================== */
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const admins = config.admins || [];
const commands = new Map();

const trollMode = new Map();
const targetTrollMode = new Map();
const lastMessageTime = new Map();
global.heyTimers = new Map();

/* 🔒 EVENT DEDUPE */
const processedMessages = new Set();

const trollMessages = require("./trollMessages").messages;

/* ================== LOAD COMMANDS ================== */
const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.set(command.name, command);
}

/* ================== LOGIN ================== */
login({ appState }, (err, api) => {
    if (err) return console.error(err);

    console.log("Logged in successfully!");

    const botID = api.getCurrentUserID();

    api.setOptions({
        listenEvents: true,
        selfListen: true, // required for self reaction
        online: true,
        forceLogin: true
    });

    api.listenMqtt((err, event) => {
        if (err) return console.error(err);

        /* ================== SELF REACTION ================== */
        if (
            event.senderID === botID &&
            (event.type === "message" || event.type === "message_reply") &&
            event.messageID
        ) {
            setTimeout(() => {
                api.setMessageReaction("😆", event.messageID, event.threadID);
            }, 200);
        }

        /* ================== DEDUPE ================== */
        if (event.messageID) {
            if (processedMessages.has(event.messageID)) return;
            processedMessages.add(event.messageID);
            setTimeout(() => processedMessages.delete(event.messageID), 60000);
        }

        if (event.type !== "message" && event.type !== "message_reply") return;

        const threadID = event.threadID;
        const senderID = event.senderID;
        const body = (event.body || "").trim();
        if (!body) return;

        /* ================== COMMAND HANDLING (ALLOW SELF) ================== */
        const args = body.split(/ +/);
        const firstWord = args.shift().toLowerCase();
        const hasPrefix = body.startsWith("/") || body.startsWith(".");
        const commandName = hasPrefix ? firstWord.slice(1) : firstWord;

        if (commands.has(commandName)) {
            if (!admins.includes(senderID)) return;

            commands.get(commandName).execute(api, event, args, {
                trollMode,
                targetTrollMode
            });

            return; // ⛔ STOP HERE — prevents auto-reply spam
        }

        /* ================== BLOCK SELF FROM AUTO REPLY ================== */
        if (senderID === botID) return;

        /* ================== CLEAR HEY TIMERS ================== */
        const timerKey = `${threadID}_${senderID}`;
        if (global.heyTimers.has(timerKey)) {
            clearTimeout(global.heyTimers.get(timerKey));
            global.heyTimers.delete(timerKey);
        }

        /* ================== TROLL / AUTO REPLY LOGIC ================== */
        const targetKey = `${threadID}_${senderID}`;
        const casterID = trollMode.get(threadID);
        const isTargeted =
            (trollMode.has(threadID) && senderID !== casterID) ||
            targetTrollMode.has(targetKey);

        if (isTargeted) {
            const now = Date.now();
            const lastTime = lastMessageTime.get(targetKey) || 0;

            if (now - lastTime >= 4000) {
                lastMessageTime.set(targetKey, now);

                const isBump = body === "." || body.toLowerCase().includes("bump");
                const hasAttachment = event.attachments?.length > 0;

                if (hasAttachment || isBump || body) {
                    setTimeout(() => {
                        const randomTroll =
                            trollMessages[Math.floor(Math.random() * trollMessages.length)];
                        api.sendMessage({ body: randomTroll }, threadID, event.messageID);
                    }, 4000);
                }
            }
        }
    });
});
