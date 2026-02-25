const { getChatHistoryKey } = require('./store-utils');

function createChatHistoryApi(store) {
    function getChatHistory(agentId) {
        if (!agentId) {
            return [];
        }

        const history = store.get(getChatHistoryKey(agentId), []);
        return Array.isArray(history) ? history : [];
    }

    function appendMessage(agentId, message) {
        if (!agentId || !message) {
            return getChatHistory(agentId);
        }

        const history = getChatHistory(agentId);
        history.push(message);
        store.set(getChatHistoryKey(agentId), history);
        return history;
    }

    function clearHistory(agentId) {
        if (!agentId) {
            return;
        }
        store.set(getChatHistoryKey(agentId), []);
    }

    function deleteHistory(agentId) {
        if (!agentId) {
            return;
        }
        store.delete(getChatHistoryKey(agentId));
    }

    return {
        getChatHistory,
        appendMessage,
        clearHistory,
        deleteHistory,
    };
}

module.exports = {
    createChatHistoryApi,
};
