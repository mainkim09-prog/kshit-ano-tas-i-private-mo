const trollMessages = require('../trollMessages').messages;

module.exports = {
    name: "pst",
    description: "Toggles persistent troll mode for specific users",
    async execute(api, event, args, extras) {
        const { targetTrollMode } = extras;
        const mentions = event.mentions;
        const threadID = event.threadID;

        if (!mentions || Object.keys(mentions).length === 0) {
            return api.sendMessage("nge", threadID);
        }

        const targetIDs = Object.keys(mentions);
        
        targetIDs.forEach(targetID => {
            const targetKey = `${threadID}_${targetID}`;
            const name = mentions[targetID].replace('@', '');

            if (targetTrollMode.has(targetKey)) {
                targetTrollMode.delete(targetKey);
                // Clear any existing timer when toggling off
                if (global.heyTimers && global.heyTimers.has(targetKey)) {
                    clearTimeout(global.heyTimers.get(targetKey));
                    global.heyTimers.delete(targetKey);
                }
                api.sendMessage(`lezzgoo`, threadID);
            } else {
                targetTrollMode.set(targetKey, true);
                api.sendMessage(`ayaw ko na`, threadID);

                if (!global.heyTimers) global.heyTimers = new Map();
                
                const timer = setTimeout(() => {
                    const trollMessages = require('../trollMessages').messages;
                    const randomTroll = trollMessages[Math.floor(Math.random() * trollMessages.length)];
                    api.sendMessage(`@${name} ${randomTroll}`, threadID, null, [targetID]);
                    global.heyTimers.delete(targetKey);
                }, 10000);
                
                global.heyTimers.set(targetKey, timer);
            }
        });
    }
};
