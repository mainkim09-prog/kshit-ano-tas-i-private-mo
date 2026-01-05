const trollMessages = require('../trollMessages').messages;

module.exports = {
    name: "all",
    description: "Toggles troll mode for the group chat",
    async execute(api, event, args, extras) {
        const { trollMode } = extras;
        const threadID = event.threadID;
        const senderID = event.senderID;

        if (trollMode.has(threadID)) {
            trollMode.delete(threadID);
            api.sendMessage("bouncr na me", threadID);
        } else {
            trollMode.set(threadID, senderID);
            api.sendMessage("palag mga engot", threadID);
        }
    }
};
