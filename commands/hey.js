const trollMessages = require('../trollMessages').messages;

module.exports = {
    name: "hey",
    description: "Toggle troll mode by name (single or comma-separated)",
    async execute(api, event, args, extras) {
        const { targetTrollMode } = extras;
        const threadID = event.threadID;

        if (!global.heyTimers) global.heyTimers = new Map();

        const sub = args.join(" ").toLowerCase();

        let threadInfo;
        try {
            threadInfo = await api.getThreadInfo(threadID);
        } catch {
            return api.sendMessage("no", threadID);
        }

        const users = threadInfo.userInfo || [];

        // =====================
        // hey who
        // =====================
        if (sub === "who") {
            const names = [];

            for (const key of targetTrollMode.keys()) {
                if (!key.startsWith(threadID + "_")) continue;

                const userID = key.split("_")[1];
                const user = users.find(u => u.id === userID);
                if (user?.name) names.push(user.name);
            }

            if (names.length === 0) {
                return api.sendMessage("no", threadID);
            }

            return api.sendMessage(names.join(", "), threadID);
        }

        // =====================
        // hey stop
        // =====================
        if (sub === "stop") {
            let stopped = false;

            for (const [key, timer] of global.heyTimers.entries()) {
                if (!key.startsWith(threadID + "_")) continue;

                clearTimeout(timer);
                global.heyTimers.delete(key);
                targetTrollMode.delete(key);
                stopped = true;
            }

            return api.sendMessage(stopped ? "yes" : "no", threadID);
        }

        // =====================
        // hey loretta, reo, kazu
        // =====================
        if (!sub) {
            return api.sendMessage("no", threadID);
        }

        const nameInputs = sub
            .split(",")
            .map(n => n.trim())
            .filter(Boolean);

        let success = false;

        for (const input of nameInputs) {
            const matches = users.filter(
                u => u.name && u.name.toLowerCase().includes(input)
            );

            if (matches.length !== 1) continue;

            const target = matches[0];
            const targetKey = `${threadID}_${target.id}`;

            // TOGGLE OFF
            if (targetTrollMode.has(targetKey)) {
                targetTrollMode.delete(targetKey);

                if (global.heyTimers.has(targetKey)) {
                    clearTimeout(global.heyTimers.get(targetKey));
                    global.heyTimers.delete(targetKey);
                }

                success = true;
                continue;
            }

            // TOGGLE ON
            targetTrollMode.set(targetKey, true);
            success = true;

            const timer = setTimeout(() => {
                const randomTroll =
                    trollMessages[Math.floor(Math.random() * trollMessages.length)];

                api.sendMessage(
                    `${target.name} ${randomTroll}`,
                    threadID
                );

                global.heyTimers.delete(targetKey);
            }, 10000);

            global.heyTimers.set(targetKey, timer);
        }

        return api.sendMessage(success ? "yes" : "no", threadID);
    }
};
