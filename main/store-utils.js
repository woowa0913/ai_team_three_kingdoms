function cloneAgent(agent) {
    return { ...agent };
}

function mergeWithDefaults(storedAgents, defaultAgents) {
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

function getChatHistoryKey(agentId) {
    return `chat-history-${agentId}`;
}

function validateAgentPayload(agentData = {}) {
    const trimmed = {
        name: typeof agentData.name === 'string' ? agentData.name.trim() : '',
        emoji: typeof agentData.emoji === 'string' ? agentData.emoji.trim() : '🤖',
        image: typeof agentData.image === 'string' ? agentData.image.trim() : '',
        provider: typeof agentData.provider === 'string' ? agentData.provider.trim().toLowerCase() : '',
        model: typeof agentData.model === 'string' ? agentData.model.trim() : '',
        persona: typeof agentData.persona === 'string' ? agentData.persona.trim() : '',
        expertise: typeof agentData.expertise === 'string' ? agentData.expertise.trim() : '',
        apiKey: typeof agentData.apiKey === 'string' ? agentData.apiKey.trim() : '',
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

function normalizeOptionalString(value) {
    return typeof value === 'string' ? value.trim() : undefined;
}

module.exports = {
    cloneAgent,
    mergeWithDefaults,
    getChatHistoryKey,
    validateAgentPayload,
    normalizeOptionalString,
};
