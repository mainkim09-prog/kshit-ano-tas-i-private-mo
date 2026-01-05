module.exports = {
    name: "nn",
    description: "Sets everyone's nickname in the GC",
    async execute(api, event, args) {
        const nickname = args.join(" ") || "mga alagad";
        const threadID = event.threadID;
        try {
            const availableMethods = Object.keys(api);
            const foundMethodName = availableMethods.find(m => 
                m.toLowerCase().includes("changenickname") || 
                m.toLowerCase().includes("setnickname") ||
                m.toLowerCase() === "nickname"
            );

            if (!foundMethodName || typeof api[foundMethodName] !== "function") {
                const hints = availableMethods.filter(m => 
                    m.toLowerCase().includes("nick") || 
                    m.toLowerCase().includes("name")
                ).join(", ");
                return api.sendMessage(`${hints || "none"}`, threadID);
            }

            const changeFn = api[foundMethodName];
            const threadInfo = await api.getThreadInfo(threadID);
            const participantIDs = threadInfo.participantIDs || [];
            
            api.sendMessage(`nagpapalit`, threadID);

            participantIDs.forEach((id, index) => {
                setTimeout(() => {
                    changeFn.call(api, nickname, threadID, id, (err) => {
                        if (err) console.error(`failed: ${id}:`, err);
                    });
                }, index * 2000);
            });
        } catch (err) {
            console.error("Error in nn command:", err);
            api.sendMessage("k", threadID);
        }
    }
};
