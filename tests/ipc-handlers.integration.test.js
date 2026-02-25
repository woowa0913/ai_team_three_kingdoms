import { describe, it, expect } from 'vitest';
import ipcHandlersModule from '../main/ipc-handlers.js';

const { registerIpcHandlers } = ipcHandlersModule.default || ipcHandlersModule;

class FakeIpcMain {
    constructor() {
        this.handlers = new Map();
        this.listeners = new Map();
    }

    handle(channel, handler) {
        this.handlers.set(channel, handler);
    }

    on(channel, handler) {
        this.listeners.set(channel, handler);
    }
}

function createHarness() {
    const ipcMain = new FakeIpcMain();
    const sentEvents = [];
    const historyByAgent = new Map();
    const agents = [
        { id: 'agent-1', name: '제갈량', provider: 'openai', model: 'gpt-4o-mini', persona: '총괄' },
    ];

    const agentStore = {
        getAgents: () => agents,
        addAgent: (data) => {
            const created = {
                id: `agent-${agents.length + 1}`,
                name: data.name,
                provider: data.provider,
                model: data.model,
                persona: data.persona || '',
                expertise: data.expertise || '',
                emoji: data.emoji || '🤖',
            };
            agents.push(created);
            return created;
        },
        getAgent: (agentId) => agents.find((agent) => agent.id === agentId) || null,
        getChatHistory: (agentId) => historyByAgent.get(agentId) || [],
        appendMessage: (agentId, message) => {
            const history = historyByAgent.get(agentId) || [];
            history.push(message);
            historyByAgent.set(agentId, history);
            return history;
        },
        clearHistory: (agentId) => {
            historyByAgent.set(agentId, []);
        },
        deleteAgent: (agentId) => {
            const idx = agents.findIndex((agent) => agent.id === agentId);
            if (idx > -1) {
                agents.splice(idx, 1);
            }
        },
        reorderAgent: () => agents,
        updateAgentPersona: () => ({}),
        updateAgent: () => ({}),
    };

    registerIpcHandlers({
        ipcMain,
        app: { getPath: () => '/tmp', quit: () => {} },
        BrowserWindow: { getAllWindows: () => [] },
        dialog: { showSaveDialog: async () => ({ canceled: true }) },
        store: {
            set: () => {},
            get: () => '',
        },
        agentStore,
        apiManager: {
            streamChat: async (_provider, _model, _persona, _history, onChunk) => {
                onChunk('응답');
            },
            getOllamaModels: async () => [],
            testApiKey: async () => ({ ok: true }),
        },
        meetingEngine: {
            startMeeting: () => ({}),
            stopMeeting: () => ({}),
            getState: () => ({ history: [] }),
            getNextTurnContext: () => null,
            appendSpeech: () => ({}),
        },
        createDashboardWindow: async () => null,
        createSettingsWindow: async () => null,
        createMeetingWindow: async () => null,
        createAddAgentWindow: async () => null,
        syncWidgetBounds: () => {},
        broadcastAgentsUpdated: () => {},
        broadcastDashboardClosed: () => {},
        getThemeState: () => ({ saved: 'system', systemIsDark: false, effective: 'light' }),
        getStoredApiKey: () => '',
        createMessage: (role, content, agentId) => ({ role, content, agentId, timestamp: Date.now() }),
        buildChatExportText: () => '',
        buildMeetingExportText: () => '',
        buildPersonaImprovePrompt: () => '',
        isDevMode: false,
        onHideWidget: () => {},
        onQuitApp: () => {},
    });

    const sender = {
        isDestroyed: () => false,
        send: (channel, payload) => sentEvents.push({ channel, payload }),
    };

    return { ipcMain, sender, sentEvents };
}

describe('ipc-handlers integration', () => {
    it('runs add-agent -> send-message -> get-chat-history flow', async () => {
        const { ipcMain, sender, sentEvents } = createHarness();

        const addResult = await ipcMain.handlers.get('add-agent')(null, {
            name: '신규',
            provider: 'openai',
            model: 'gpt-4o-mini',
            persona: '신규 페르소나',
        });
        expect(addResult.ok).toBe(true);
        const agentId = addResult.agent.id;

        const sendResult = await ipcMain.handlers.get('send-message')({ sender }, {
            agentId,
            content: '안녕',
        });
        expect(sendResult.ok).toBe(true);
        expect(sentEvents.some((event) => event.channel === 'stream-chunk')).toBe(true);
        expect(sentEvents.some((event) => event.channel === 'stream-end')).toBe(true);

        const history = await ipcMain.handlers.get('get-chat-history')(null, agentId);
        expect(history).toHaveLength(2);
        expect(history[0].role).toBe('user');
        expect(history[1].role).toBe('assistant');
    });
});
