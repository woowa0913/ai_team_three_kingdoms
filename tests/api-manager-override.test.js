import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createSseResponse(chunks) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
            controller.close();
        },
    });
    return {
        ok: true,
        body: stream,
        status: 200,
        statusText: 'OK',
        text: async () => '',
    };
}

describe('api-manager override', () => {
    let apiManager;
    let originalFetch;

    beforeEach(async () => {
        vi.resetModules();
        originalFetch = global.fetch;
        const imported = await import('../main/api-manager.js');
        apiManager = imported.default || imported;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('passes apiKeyOverride to provider request headers', async () => {
        const fetchMock = vi.fn(async () => createSseResponse([
            'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
            'data: [DONE]\n\n',
        ]));
        global.fetch = fetchMock;

        await apiManager.streamChat(
            'openai',
            'gpt-4o-mini',
            'persona',
            [{ role: 'user', content: 'hello' }],
            () => {},
            () => {},
            () => {},
            'sk-agent-override'
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const options = fetchMock.mock.calls[0][1];
        expect(options.headers.authorization).toBe('Bearer sk-agent-override');
    });
});
