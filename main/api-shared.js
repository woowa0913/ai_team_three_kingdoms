const Store = require('electron-store');
const { getStoreOptions } = require('./store-config');

const store = new Store(getStoreOptions());

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

function normalizeMessages(messages = [], maxMessages = 40) {
    if (!Array.isArray(messages)) {
        return [];
    }

    const normalized = messages
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .map((message) => ({
            role: message.role,
            content: typeof message.content === 'string' ? message.content : '',
        }))
        .filter((message) => message.content.length > 0);

    const safeMax = Number.isFinite(maxMessages) ? Math.max(1, Math.floor(maxMessages)) : 40;
    if (normalized.length <= safeMax) {
        return normalized;
    }

    const firstUserIndex = normalized.findIndex((message) => message.role === 'user');
    const sliced = normalized.slice(-safeMax);
    if (firstUserIndex < 0 || firstUserIndex >= normalized.length - safeMax) {
        return sliced;
    }

    const firstUser = normalized[firstUserIndex];
    const tailCount = Math.max(0, safeMax - 1);
    const tail = tailCount === 0 ? [] : normalized.slice(-tailCount);
    let merged = [firstUser, ...tail];
    while (merged.length > safeMax) {
        merged = merged.slice(1);
    }
    while (merged.length > 0 && merged[0].role !== 'user') {
        merged = merged.slice(1);
    }
    return merged;
}

function getApiKey(provider, agentApiKey) {
    const overrideKey = typeof agentApiKey === 'string' ? agentApiKey.trim() : '';
    if (overrideKey.length > 0) {
        return overrideKey;
    }

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
    } catch (_error) {
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
            if (parsed) {
                await onObject(parsed);
            }
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

module.exports = {
    DEFAULT_MODELS,
    normalizeMessages,
    getApiKey,
    ensureStreamableResponse,
    safeJsonParse,
    parseSseStream,
    parseNdjsonStream,
};
