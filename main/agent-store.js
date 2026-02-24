const path = require('path');
const Store = require('electron-store');

const store = new Store();
const defaultAgents = require(path.join(__dirname, '..', 'config', 'default-agents.json'));

function getAgents() {
    const agents = store.get('agents', defaultAgents);
    if (Array.isArray(agents)) {
        return agents;
    }

    store.set('agents', defaultAgents);
    return defaultAgents;
}

function getAgent(agentId) {
    if (!agentId) {
        return null;
    }

    return getAgents().find((agent) => agent.id === agentId) || null;
}

function getChatHistoryKey(agentId) {
    return `chat-history-${agentId}`;
}

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

module.exports = {
    getAgents,
    getAgent,
    getChatHistory,
    appendMessage,
    clearHistory,
};
