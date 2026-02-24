const path = require('path');
const Store = require('electron-store');

const store = new Store();
const defaultAgents = require(path.join(__dirname, '..', 'config', 'default-agents.json'));
const DEFAULT_PROTECTED_AGENT_ID = 'agent-1';

function cloneAgent(agent) {
    return { ...agent };
}

function seedDefaultAgents() {
    const seeded = defaultAgents.map(cloneAgent);
    store.set('agents', seeded);
    return seeded;
}

function mergeWithDefaults(storedAgents) {
    const byId = new Map();
    storedAgents.forEach((agent) => {
        if (agent && typeof agent.id === 'string') {
            byId.set(agent.id, { ...agent });
        }
    });

    const merged = [];
    defaultAgents.forEach((agent) => {
        const current = byId.get(agent.id);
        merged.push(current ? { ...agent, ...current } : cloneAgent(agent));
        byId.delete(agent.id);
    });

    byId.forEach((agent) => {
        merged.push({ ...agent });
    });

    return merged;
}

function getAgents() {
    const agents = store.get('agents');
    if (!Array.isArray(agents)) {
        return seedDefaultAgents();
    }

    const merged = mergeWithDefaults(agents);
    if (merged.length !== agents.length || JSON.stringify(merged) !== JSON.stringify(agents)) {
        store.set('agents', merged);
    }

    return merged;
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

function validateAgentPayload(agentData = {}) {
    const trimmed = {
        name: typeof agentData.name === 'string' ? agentData.name.trim() : '',
        emoji: typeof agentData.emoji === 'string' ? agentData.emoji.trim() : '🤖',
        provider: typeof agentData.provider === 'string' ? agentData.provider.trim().toLowerCase() : '',
        model: typeof agentData.model === 'string' ? agentData.model.trim() : '',
        persona: typeof agentData.persona === 'string' ? agentData.persona.trim() : '',
        expertise: typeof agentData.expertise === 'string' ? agentData.expertise.trim() : '',
    };

    if (!trimmed.name) {
        throw new Error('에이전트 이름을 입력해주세요.');
    }
    if (!trimmed.provider) {
        throw new Error('AI 제공자를 선택해주세요.');
    }
    if (!trimmed.model) {
        throw new Error('모델명을 입력해주세요.');
    }

    return trimmed;
}

function addAgent(agentData) {
    const validated = validateAgentPayload(agentData);
    const agents = getAgents();
    const created = {
        id: `agent-${Date.now()}`,
        name: validated.name,
        emoji: validated.emoji || '🤖',
        provider: validated.provider,
        model: validated.model,
        persona: validated.persona || `${validated.name} 에이전트입니다.`,
        expertise: validated.expertise || '일반 업무',
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
    store.delete(getChatHistoryKey(agentId));
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

module.exports = {
    getAgents,
    getAgent,
    getChatHistory,
    appendMessage,
    clearHistory,
    addAgent,
    deleteAgent,
    updateAgentPersona,
};
