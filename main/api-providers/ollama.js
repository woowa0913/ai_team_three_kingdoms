const {
    ensureStreamableResponse,
    parseNdjsonStream,
} = require('../api-shared');

async function streamFromOllama(model, persona, messages, onChunk, _apiKeyOverride) {
    let response;
    try {
        response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                stream: true,
                messages: [
                    ...(persona ? [{ role: 'system', content: persona }] : []),
                    ...messages.map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                ],
            }),
        });
    } catch (error) {
        if (
            error &&
            error.name === 'TypeError' &&
            typeof error.message === 'string' &&
            error.message.toLowerCase().includes('fetch failed')
        ) {
            throw new Error('Ollama가 실행 중이지 않습니다. localhost:11434 서버를 확인해주세요.');
        }
        throw error;
    }

    await ensureStreamableResponse(response, 'Ollama');
    await parseNdjsonStream(response, (payload) => {
        const chunk = payload?.message?.content;
        if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
        }
    });
}

async function getOllamaModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json().catch(() => null);
        const models = Array.isArray(payload?.models) ? payload.models : [];
        return models
            .map((model) => (typeof model?.name === 'string' ? model.name.trim() : ''))
            .filter(Boolean);
    } catch (_error) {
        return [];
    }
}

module.exports = {
    streamFromOllama,
    getOllamaModels,
};
