const {
    getApiKey,
    ensureStreamableResponse,
    safeJsonParse,
    parseSseStream,
} = require('../api-shared');

async function streamFromGoogle(model, persona, messages, onChunk, apiKeyOverride) {
    const apiKey = getApiKey('google', apiKeyOverride);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    let lastMergedText = '';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            system_instruction: persona ? { parts: [{ text: persona }] } : undefined,
            contents: messages.map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
            })),
        }),
    });

    await ensureStreamableResponse(response, 'Google');
    await parseSseStream(response, ({ data }) => {
        if (data === '[DONE]') {
            return;
        }
        const payload = safeJsonParse(data);
        if (!payload) {
            return;
        }
        const mergedText = (payload.candidates || [])
            .flatMap((candidate) => candidate?.content?.parts || [])
            .map((part) => part?.text || '')
            .join('');
        if (!mergedText) {
            return;
        }
        let delta = mergedText;
        if (mergedText.startsWith(lastMergedText)) {
            delta = mergedText.slice(lastMergedText.length);
        }
        lastMergedText = mergedText;
        if (delta.length > 0) {
            onChunk(delta);
        }
    });
}

async function testGoogleApiKey(apiKey, model) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: {
                maxOutputTokens: 1,
            },
        }),
    });

    if (response.ok) {
        return { ok: true };
    }

    const errorText = await response.text().catch(() => '');
    return { ok: false, error: `Google API 요청 실패 (${response.status}): ${errorText.slice(0, 160) || response.statusText}` };
}

module.exports = {
    streamFromGoogle,
    testGoogleApiKey,
};
