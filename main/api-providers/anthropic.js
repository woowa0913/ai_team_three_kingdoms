const {
    getApiKey,
    ensureStreamableResponse,
    safeJsonParse,
    parseSseStream,
} = require('../api-shared');

async function streamFromAnthropic(model, persona, messages, onChunk, apiKeyOverride) {
    const apiKey = getApiKey('anthropic', apiKeyOverride);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 2048,
            stream: true,
            system: persona || '',
            messages: messages.map((message) => ({
                role: message.role,
                content: message.content,
            })),
        }),
    });

    await ensureStreamableResponse(response, 'Anthropic');
    await parseSseStream(response, ({ data }) => {
        if (data === '[DONE]') {
            return;
        }
        const payload = safeJsonParse(data);
        const chunk = payload?.delta?.text;
        if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
        }
    });
}

async function testAnthropicApiKey(apiKey, model) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
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
    return { ok: false, error: `Anthropic API 요청 실패 (${response.status}): ${errorText.slice(0, 160) || response.statusText}` };
}

module.exports = {
    streamFromAnthropic,
    testAnthropicApiKey,
};
