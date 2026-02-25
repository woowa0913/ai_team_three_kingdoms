const {
    getApiKey,
    ensureStreamableResponse,
    safeJsonParse,
    parseSseStream,
} = require('../api-shared');

async function streamFromOpenAI(model, persona, messages, onChunk, apiKeyOverride) {
    const apiKey = getApiKey('openai', apiKeyOverride);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
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

    await ensureStreamableResponse(response, 'OpenAI');
    await parseSseStream(response, ({ data }) => {
        if (data === '[DONE]') {
            return;
        }
        const payload = safeJsonParse(data);
        const chunk = payload?.choices?.[0]?.delta?.content;
        if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
        }
    });
}

async function testOpenAIApiKey(apiKey, model) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
        }),
    });

    if (response.ok) {
        return { ok: true };
    }

    const errorText = await response.text().catch(() => '');
    return { ok: false, error: `OpenAI API 요청 실패 (${response.status}): ${errorText.slice(0, 160) || response.statusText}` };
}

module.exports = {
    streamFromOpenAI,
    testOpenAIApiKey,
};
