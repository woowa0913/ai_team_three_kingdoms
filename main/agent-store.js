const path = require('path');
const Store = require('electron-store');
const { createChatHistoryApi } = require('./chat-history');
const { getStoreOptions } = require('./store-config');
const { loadAndMigrateAgents } = require('./store-migration');
const { validateAgentPayload, normalizeOptionalString } = require('./store-utils');

const store = new Store(getStoreOptions());
const defaultAgents = require(path.join(__dirname, '..', 'config', 'default-agents.json'));
const DEFAULT_PROTECTED_AGENT_ID = 'agent-1';
const chatHistory = createChatHistoryApi(store);

function normalizeAgentApiKey(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getAgents() {
    const agents = loadAndMigrateAgents(store, defaultAgents);
    let changed = false;
    const normalized = agents.map((agent) => {
        const apiKey = normalizeAgentApiKey(agent?.apiKey);
        if (agent?.apiKey !== apiKey) {
            changed = true;
        }
        return { ...agent, apiKey };
    });
    if (changed) {
        store.set('agents', normalized);
    }
    return normalized;
}

function getAgent(agentId) {
    if (!agentId) {
        return null;
    }

    return getAgents().find((agent) => agent.id === agentId) || null;
}

function addAgent(agentData) {
    const validated = validateAgentPayload(agentData);
    const agents = getAgents();
    const created = {
        id: `agent-${Date.now()}`,
        name: validated.name,
        emoji: validated.emoji || '🤖',
        image: validated.image || '',
        provider: validated.provider,
        model: validated.model,
        persona: validated.persona || `${validated.name} 에이전트입니다.`,
        expertise: validated.expertise || '일반 업무',
        apiKey: validated.apiKey || '',
    };

    agents.push(created);
    store.set('agents', agents);
    return created;
}

function deleteAgent(agentId) {
    if (!agentId) {
        throw new Error('삭제할 에이전트 ID가 필요합니다.');
    }
    if (agentId === DEFAULT_PROTECTED_AGENT_ID) {
        throw new Error('오케스트레이터(agent-1)는 삭제할 수 없습니다.');
    }

    const agents = getAgents();
    const exists = agents.some((agent) => agent.id === agentId);
    if (!exists) {
        throw new Error('삭제할 에이전트를 찾을 수 없습니다.');
    }

    const nextAgents = agents.filter((agent) => agent.id !== agentId);
    store.set('agents', nextAgents);
    chatHistory.deleteHistory(agentId);
    return nextAgents;
}

function updateAgentPersona(agentId, persona) {
    const safePersona = typeof persona === 'string' ? persona.trim() : '';
    if (!agentId) {
        throw new Error('agentId가 필요합니다.');
    }
    if (!safePersona) {
        throw new Error('페르소나 내용이 비어 있습니다.');
    }

    const agents = getAgents();
    const index = agents.findIndex((agent) => agent.id === agentId);
    if (index < 0) {
        throw new Error('에이전트를 찾을 수 없습니다.');
    }

    const updated = { ...agents[index], persona: safePersona };
    agents[index] = updated;
    store.set('agents', agents);
    return updated;
}

function updateAgent(agentId, payload = {}) {
    if (!agentId) {
        throw new Error('agentId가 필요합니다.');
    }

    const agents = getAgents();
    const index = agents.findIndex((agent) => agent.id === agentId);
    if (index < 0) {
        throw new Error('에이전트를 찾을 수 없습니다.');
    }

    const current = agents[index];
    const name = normalizeOptionalString(payload.name);
    const emoji = normalizeOptionalString(payload.emoji);
    const model = normalizeOptionalString(payload.model);
    const expertise = normalizeOptionalString(payload.expertise);
    const apiKey = normalizeOptionalString(payload.apiKey);

    if (name !== undefined && !name) {
        throw new Error('에이전트 이름을 입력해주세요.');
    }
    if (model !== undefined && !model) {
        throw new Error('모델명을 입력해주세요.');
    }

    const updated = {
        ...current,
        name: name !== undefined ? name : current.name,
        emoji: emoji !== undefined ? (emoji || '🤖') : (current.emoji || '🤖'),
        model: model !== undefined ? model : current.model,
        expertise: expertise !== undefined ? expertise : current.expertise,
        apiKey: apiKey !== undefined ? (apiKey || '') : normalizeAgentApiKey(current.apiKey),
    };

    agents[index] = updated;
    store.set('agents', agents);
    return updated;
}

function reorderAgent(agentId, direction) {
    if (!agentId) {
        throw new Error('agentId가 필요합니다.');
    }
    if (!['left', 'right'].includes(direction)) {
        throw new Error('direction은 left 또는 right여야 합니다.');
    }

    const agents = getAgents();
    const index = agents.findIndex((agent) => agent.id === agentId);
    if (index < 0) {
        throw new Error('에이전트를 찾을 수 없습니다.');
    }

    const nextIndex = direction === 'left' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= agents.length) {
        return agents;
    }

    const [target] = agents.splice(index, 1);
    agents.splice(nextIndex, 0, target);
    store.set('agents', agents);
    return agents;
}

module.exports = {
    getAgents,
    getAgent,
    getChatHistory: chatHistory.getChatHistory,
    appendMessage: chatHistory.appendMessage,
    clearHistory: chatHistory.clearHistory,
    addAgent,
    deleteAgent,
    updateAgentPersona,
    updateAgent,
    reorderAgent,
};
