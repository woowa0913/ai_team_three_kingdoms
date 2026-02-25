import { describe, it, expect } from 'vitest';
import apiManagerModule from '../main/api-manager.js';

const apiManager = apiManagerModule.default || apiManagerModule;

function createStreamResponse(chunks) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
            controller.close();
        },
    });
    return { body: stream };
}

describe('api-manager', () => {
    it('normalizes messages and keeps max window', () => {
        const normalized = apiManager._private.normalizeMessages(
            [
                { role: 'system', content: 'skip' },
                { role: 'user', content: 'u1' },
                { role: 'assistant', content: 'a1' },
                { role: 'user', content: 'u2' },
            ],
            2
        );
        expect(normalized).toEqual([
            { role: 'user', content: 'u1' },
            { role: 'user', content: 'u2' },
        ]);
    });

    it('parses SSE stream fragments', async () => {
        const response = createStreamResponse([
            'event: message\n',
            'data: {"a":1}\n\n',
            'data: [DONE]\n\n',
        ]);
        const events = [];
        await apiManager._private.parseSseStream(response, (payload) => {
            events.push(payload);
        });
        expect(events).toEqual([
            { eventType: 'message', data: '{"a":1}' },
            { eventType: 'message', data: '[DONE]' },
        ]);
    });

    it('parses NDJSON stream objects', async () => {
        const response = createStreamResponse([
            '{"x":1}\n',
            '{"x":2}\n',
        ]);
        const rows = [];
        await apiManager._private.parseNdjsonStream(response, (payload) => {
            rows.push(payload);
        });
        expect(rows).toEqual([{ x: 1 }, { x: 2 }]);
    });
});
