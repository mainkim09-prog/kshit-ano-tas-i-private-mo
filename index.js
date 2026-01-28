const { login } = require("biar-fca");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const port = 5000;

app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bot Uptime</title>
            <style>
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a1a; color: white; }
                .status { padding: 20px; border-radius: 8px; background: #333; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                h1 { margin: 0 0 10px 0; color: #4caf50; }
            </style>
        </head>
        <body>
            <div class="status">
                <h1>Bot is Online</h1>
                <p>Uptime monitoring active.</p>
            </div>
        </body>
        </html>
    `);
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Uptime server running on port ${port}`);
});

// Load appstate
let appState;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (err) {
    console.error("Error reading appstate.json.");
    process.exit(1);
}

// Load config & commands
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const admins = config.admins || [];
const commands = new Map();

const trollMode = new Map();
const targetTrollMode = new Map();
const lastMessageTime = new Map();
global.heyTimers = new Map();

// 🔒 Message de-duplication (FIXES DOUBLE REPLIES)
const processedMessages = new Set();

const trollMessages = require("./trollMessages").messages;
const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.set(command.name, command);
}

login({ appState }, (err, api) => {
    if (err) return console.error(err);

    console.log("Logged in successfully!");

    api.setOptions({
        listenEvents: true,
        selfListen: true,
        online: true,
        forceLogin: true
    });

    api.listenMqtt((err, event) => {
        if (err) return console.error(err);

        // 😆 Self reaction (allowed)
        if (
            event.senderID === api.getCurrentUserID() &&
            (event.type === "message" || event.type === "message_reply") &&
            event.messageID
        ) {
            setTimeout(() => {
                api.setMessageReaction("😆", event.messageID, event.threadID);
            }, 200);
        }

        // 🛑 Stop bot messages from triggering logic
        if (event.senderID === api.getCurrentUserID()) return;

        // 🔒 DEDUPE: prevent double replies
        if (event.messageID) {
            if (processedMessages.has(event.messageID)) return;

            processedMessages.add(event.messageID);
            setTimeout(() => {
                processedMessages.delete(event.messageID);
            }, 60000);
        }

        if (event.type !== "message" && event.type !== "message_reply") {
            if (event.type === "message_unsend") {
                // optional unsend logic
            }
        }

        const threadID = event.threadID;
        const senderID = event.senderID;
        const body = (event.body || "").trim();

        // Clear hey timers
        if (body) {
            const timerKey = `${threadID}_${senderID}`;
            if (global.heyTimers.has(timerKey)) {
                clearTimeout(global.heyTimers.get(timerKey));
                global.heyTimers.delete(timerKey);
            }
        }

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

                    if (
                        !body.startsWith("/") &&
                        !body.startsWith(".") &&
                        !commands.has(body.split(" ")[0].toLowerCase())
                    ) {
                        return;
                    }
                }
            }
        }

        if (!body) return;

        const args = body.split(/ +/);
        const firstWord = args.shift().toLowerCase();
        const hasPrefix = body.startsWith("/") || body.startsWith(".");
        const commandName = hasPrefix ? firstWord.slice(1) : firstWord;

        if (commands.has(commandName)) {
            if (!admins.includes(senderID)) return;
            commands.get(commandName).execute(api, event, args, { trollMode, targetTrollMode });
        } else if (commands.has(firstWord)) {
            if (!admins.includes(senderID)) return;
            commands.get(firstWord).execute(api, event, args, { trollMode, targetTrollMode });
        }
    });
});
