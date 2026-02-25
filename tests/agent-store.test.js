import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('agent-store', () => {
    let tempDir;
    let agentStore;

    beforeEach(async () => {
        vi.resetModules();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-orchestra-store-test-'));
        process.env.AI_ORCHESTRA_STORE_CWD = tempDir;
        const imported = await import('../main/agent-store.js');
        agentStore = imported.default || imported;
    });

    afterEach(() => {
        delete process.env.AI_ORCHESTRA_STORE_CWD;
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('seeds default agents on first load', () => {
        const agents = agentStore.getAgents();
        expect(Array.isArray(agents)).toBe(true);
        expect(agents.length).toBeGreaterThanOrEqual(3);
        expect(agents.some((agent) => agent.id === 'agent-1')).toBe(true);
    });

    it('supports CRUD and chat history', () => {
        const created = agentStore.addAgent({
            name: '테스트 에이전트',
            provider: 'openai',
            model: 'gpt-4o-mini',
            persona: '테스터',
            expertise: '검증',
            apiKey: 'sk-agent-key',
        });
        expect(created.id.startsWith('agent-')).toBe(true);
        expect(created.apiKey).toBe('sk-agent-key');

        const updated = agentStore.updateAgent(created.id, { name: '수정된 이름', apiKey: 'sk-agent-key-2' });
        expect(updated.name).toBe('수정된 이름');
        expect(updated.apiKey).toBe('sk-agent-key-2');

        agentStore.appendMessage(created.id, { role: 'user', content: 'hello', timestamp: Date.now() });
        expect(agentStore.getChatHistory(created.id)).toHaveLength(1);

        agentStore.clearHistory(created.id);
        expect(agentStore.getChatHistory(created.id)).toHaveLength(0);

        const afterDelete = agentStore.deleteAgent(created.id);
        expect(afterDelete.some((agent) => agent.id === created.id)).toBe(false);
    });

    it('merges stored agents with default schema', async () => {
        const StoreModule = await import('electron-store');
        const Store = StoreModule.default || StoreModule;
        const configModule = await import('../main/store-config.js');
        const { getStoreOptions } = configModule.default || configModule;
        const store = new Store(getStoreOptions());
        store.set('agents', [{ id: 'agent-1', name: '커스텀 제갈량' }]);

        const merged = agentStore.getAgents();
        const a1 = merged.find((agent) => agent.id === 'agent-1');
        expect(a1.name).toBe('커스텀 제갈량');
        expect(typeof a1.provider).toBe('string');
        expect(typeof a1.apiKey).toBe('string');
    });
});
