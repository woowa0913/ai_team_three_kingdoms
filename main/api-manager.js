const Store = require('electron-store');
const store = new Store();
const API_KEY_MAP = {
    anthropic: 'api-key-anthropic',
    openai: 'api-key-openai',
    google: 'api-key-google',
};
const DEFAULT_MODELS = {
    anthropic: 'claude-3-7-sonnet-20250219',
    openai: 'gpt-4o-mini',
    google: 'gemini-2.0-flash',
    ollama: 'llama-3',
};
function normalizeMessages(messages = []) {
    if (!Array.isArray(messages)) {
        return [];
    }
    return messages
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .map((message) => ({
            role: message.role,
            content: typeof message.content === 'string' ? message.content : '',
        }))
        .filter((message) => message.content.length > 0);
}
function getApiKey(provider) {
    const keyName = API_KEY_MAP[provider];
    if (!keyName) {
        return null;
    }
    const apiKey = store.get(keyName, '');
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error(`${provider} API 키가 설정되지 않았습니다.`);
    }
    return apiKey.trim();
}
async function ensureStreamableResponse(response, providerLabel) {
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const message = errorText.slice(0, 250) || response.statusText;
        throw new Error(`${providerLabel} API 요청 실패 (${response.status}): ${message}`);
    }
    if (!response.body) {
        throw new Error(`${providerLabel} 스트리밍 응답을 받을 수 없습니다.`);
    }
}
function safeJsonParse(raw) {
    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}
async function parseSseStream(response, onData) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r/g, '');
        const segments = buffer.split('\n\n');
        buffer = segments.pop() || '';
        for (const segment of segments) {
            if (!segment.trim()) {
                continue;
            }
            const lines = segment.split('\n');
            let eventType = 'message';
            const dataLines = [];
            for (const line of lines) {
                if (line.startsWith('event:')) {
                    eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trimStart());
                }
            }
            const data = dataLines.join('\n').trim();
            if (!data) {
                continue;
            }
            await onData({ eventType, data });
        }
    }
    const rest = buffer + decoder.decode();
    const remaining = rest.trim();
    if (remaining) {
        const line = remaining.startsWith('data:') ? remaining.slice(5).trim() : remaining;
        if (line) {
            await onData({ eventType: 'message', data: line });
        }
    }
}
async function parseNdjsonStream(response, onObject) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            const parsed = safeJsonParse(trimmed);
            if (!parsed) {
                continue;
            }
            await onObject(parsed);
        }
    }
    const tail = (buffer + decoder.decode()).trim();
    if (tail) {
        const parsed = safeJsonParse(tail);
        if (parsed) {
            await onObject(parsed);
        }
    }
}
async function streamFromAnthropic(model, persona, messages, onChunk) {
    const apiKey = getApiKey('anthropic');
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
async function streamFromOpenAI(model, persona, messages, onChunk) {
    const apiKey = getApiKey('openai');
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
async function streamFromGoogle(model, persona, messages, onChunk) {
    const apiKey = getApiKey('google');
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
async function streamFromOllama(model, persona, messages, onChunk) {
    const response = await fetch('http://localhost:11434/api/chat', {
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
    await ensureStreamableResponse(response, 'Ollama');
    await parseNdjsonStream(response, (payload) => {
        const chunk = payload?.message?.content;
        if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
        }
    });
}
async function streamChat(provider, model, persona, messages, onChunk, onEnd, onError) {
    const safeOnChunk = typeof onChunk === 'function' ? onChunk : () => {};
    const safeOnEnd = typeof onEnd === 'function' ? onEnd : () => {};
    const safeOnError = typeof onError === 'function' ? onError : () => {};
    try {
        const normalizedProvider = typeof provider === 'string' ? provider.toLowerCase() : '';
        const normalizedMessages = normalizeMessages(messages);
        const resolvedModel = model || DEFAULT_MODELS[normalizedProvider];
        if (!resolvedModel) {
            throw new Error('유효한 모델 정보가 없습니다.');
        }
        if (normalizedProvider === 'anthropic') {
            await streamFromAnthropic(resolvedModel, persona, normalizedMessages, safeOnChunk);
        } else if (normalizedProvider === 'openai') {
            await streamFromOpenAI(resolvedModel, persona, normalizedMessages, safeOnChunk);
        } else if (normalizedProvider === 'google') {
            await streamFromGoogle(resolvedModel, persona, normalizedMessages, safeOnChunk);
        } else if (normalizedProvider === 'ollama') {
            await streamFromOllama(resolvedModel, persona, normalizedMessages, safeOnChunk);
        } else {
            throw new Error(`지원하지 않는 provider입니다: ${provider}`);
        }
        safeOnEnd();
    } catch (error) {
        safeOnError(error);
        throw error;
    }
}
module.exports = {
    streamChat,
};
