const {
    DEFAULT_MODELS,
    normalizeMessages,
    safeJsonParse,
    parseSseStream,
    parseNdjsonStream,
} = require('./api-shared');
const { streamFromAnthropic, testAnthropicApiKey } = require('./api-providers/anthropic');
const { streamFromOpenAI, testOpenAIApiKey } = require('./api-providers/openai');
const { streamFromGoogle, testGoogleApiKey } = require('./api-providers/google');
const { streamFromOllama, getOllamaModels } = require('./api-providers/ollama');

async function testApiKey(provider, key) {
    const normalizedProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
    const apiKey = typeof key === 'string' ? key.trim() : '';
    if (!apiKey) {
        return { ok: false, error: 'API 키가 비어 있습니다.' };
    }

    try {
        if (normalizedProvider === 'anthropic') {
            return await testAnthropicApiKey(apiKey, DEFAULT_MODELS.anthropic);
        }
        if (normalizedProvider === 'openai') {
            return await testOpenAIApiKey(apiKey, DEFAULT_MODELS.openai);
        }
        if (normalizedProvider === 'google') {
            return await testGoogleApiKey(apiKey, DEFAULT_MODELS.google);
        }
        return { ok: false, error: '지원하지 않는 provider입니다.' };
    } catch (error) {
        return { ok: false, error: error?.message || 'API 연결 테스트에 실패했습니다.' };
    }
}

async function streamChat(provider, model, persona, messages, onChunk, onEnd, onError, apiKeyOverride) {
    const safeOnChunk = typeof onChunk === 'function' ? onChunk : () => {};
    const safeOnEnd = typeof onEnd === 'function' ? onEnd : () => {};
    const safeOnError = typeof onError === 'function' ? onError : () => {};

    try {
        const normalizedProvider = typeof provider === 'string' ? provider.toLowerCase() : '';
        const normalizedMessages = normalizeMessages(messages, 40);
        const resolvedModel = model || DEFAULT_MODELS[normalizedProvider];
        if (!resolvedModel) {
            throw new Error('유효한 모델 정보가 없습니다.');
        }

        if (normalizedProvider === 'anthropic') {
            await streamFromAnthropic(resolvedModel, persona, normalizedMessages, safeOnChunk, apiKeyOverride);
        } else if (normalizedProvider === 'openai') {
            await streamFromOpenAI(resolvedModel, persona, normalizedMessages, safeOnChunk, apiKeyOverride);
        } else if (normalizedProvider === 'google') {
            await streamFromGoogle(resolvedModel, persona, normalizedMessages, safeOnChunk, apiKeyOverride);
        } else if (normalizedProvider === 'ollama') {
            await streamFromOllama(resolvedModel, persona, normalizedMessages, safeOnChunk, apiKeyOverride);
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
    getOllamaModels,
    testApiKey,
    _private: {
        normalizeMessages,
        safeJsonParse,
        parseSseStream,
        parseNdjsonStream,
    },
};
