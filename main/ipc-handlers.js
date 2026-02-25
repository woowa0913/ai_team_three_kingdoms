const { registerChatMeetingHandlers } = require('./ipc-chat-meeting-handlers');
const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'google', 'ollama']);
const VALID_THEME_MODES = new Set(['dark', 'light', 'system']);
const AGENT_ID_PATTERN = /^agent-[a-zA-Z0-9_-]+$/;
function normalizeProvider(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function ensureProvider(value) {
    const provider = normalizeProvider(value);
    if (!provider || !VALID_PROVIDERS.has(provider)) {
        throw new Error('지원하지 않는 provider입니다.');
    }
    return provider;
}
function ensureAgentId(value, fieldName = 'agentId') {
    const agentId = typeof value === 'string' ? value.trim() : '';
    if (!agentId) {
        throw new Error(`${fieldName}가 필요합니다.`);
    }
    if (!AGENT_ID_PATTERN.test(agentId)) {
        throw new Error(`${fieldName} 형식이 올바르지 않습니다.`);
    }
    return agentId;
}
function ensureMessageContent(value) {
    const content = typeof value === 'string' ? value.trim() : '';
    if (!content) {
        throw new Error('메시지 내용을 입력해주세요.');
    }
    if (content.length > 12000) {
        throw new Error('메시지가 너무 깁니다.');
    }
    return content;
}
function maskApiKey(key) {
    if (!key || key.length < 8) {
        return key ? '****' : '';
    }
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
function registerIpcHandlers({
    ipcMain,
    app,
    BrowserWindow,
    dialog,
    store,
    agentStore,
    apiManager,
    meetingEngine,
    createDashboardWindow,
    createSettingsWindow,
    createMeetingWindow,
    createAddAgentWindow,
    syncWidgetBounds,
    broadcastAgentsUpdated,
    broadcastDashboardClosed,
    getThemeState,
    getStoredApiKey,
    createMessage,
    buildChatExportText,
    buildMeetingExportText,
    buildPersonaImprovePrompt,
    isDevMode,
    onHideWidget,
    onQuitApp,
}) {
    ipcMain.handle('get-agents', async () => {
        return agentStore.getAgents();
    });
    ipcMain.handle('add-agent', async (_event, agentData) => {
        try {
            const provider = normalizeProvider(agentData?.provider);
            if (provider && !VALID_PROVIDERS.has(provider)) {
                throw new Error('지원하지 않는 provider입니다.');
            }
            const created = agentStore.addAgent(agentData);
            syncWidgetBounds();
            broadcastAgentsUpdated();
            return { ok: true, agent: created };
        } catch (error) {
            return { ok: false, error: error.message || '에이전트 추가에 실패했습니다.' };
        }
    });
    ipcMain.handle('delete-agent', async (_event, agentIdRaw) => {
        try {
            const agentId = ensureAgentId(agentIdRaw);
            agentStore.deleteAgent(agentId);
            syncWidgetBounds();
            broadcastAgentsUpdated();
            return { ok: true };
        } catch (error) {
            return { ok: false, error: error.message || '에이전트 삭제에 실패했습니다.' };
        }
    });
    ipcMain.handle('reorder-agent', async (_event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const direction = payload?.direction;
            if (!['left', 'right'].includes(direction)) {
                throw new Error('direction은 left 또는 right여야 합니다.');
            }
            const updatedAgents = agentStore.reorderAgent(agentId, direction);
            broadcastAgentsUpdated();
            return { ok: true, agents: updatedAgents };
        } catch (error) {
            return { ok: false, error: error.message || '에이전트 순서 변경에 실패했습니다.' };
        }
    });
    ipcMain.on('open-dashboard', (event, agentIdRaw) => {
        (async () => {
            const agentId = ensureAgentId(agentIdRaw);
            if (!agentStore.getAgent(agentId)) {
                throw new Error('에이전트를 찾을 수 없습니다.');
            }
            const dashboardWindow = await createDashboardWindow(agentId, broadcastDashboardClosed);
            if (dashboardWindow && isDevMode && !dashboardWindow.webContents.isDevToolsOpened()) {
                dashboardWindow.webContents.openDevTools({ mode: 'detach' });
            }
        })().catch((error) => {
            console.error('open-dashboard 처리 실패:', error);
            if (!event.sender.isDestroyed()) {
                event.sender.send('stream-error', {
                    message: error.message || '대시보드 창을 열지 못했습니다.',
                });
            }
        });
    });
    ipcMain.handle('get-agent', async (_event, agentIdRaw) => {
        const agentId = ensureAgentId(agentIdRaw);
        return agentStore.getAgent(agentId);
    });
    ipcMain.handle('get-chat-history', async (_event, agentIdRaw) => {
        const agentId = ensureAgentId(agentIdRaw);
        return agentStore.getChatHistory(agentId);
    });
    ipcMain.handle('clear-history', async (_event, agentIdRaw) => {
        const agentId = ensureAgentId(agentIdRaw);
        agentStore.clearHistory(agentId);
        return { ok: true };
    });
    ipcMain.handle('update-agent-persona', async (_event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const updated = agentStore.updateAgentPersona(agentId, payload?.persona);
            broadcastAgentsUpdated();
            return { ok: true, agent: updated };
        } catch (error) {
            return { ok: false, error: error.message || '페르소나 저장에 실패했습니다.' };
        }
    });
    ipcMain.handle('update-agent', async (_event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            if (payload?.data?.provider) {
                ensureProvider(payload.data.provider);
            }
            const updated = agentStore.updateAgent(agentId, payload?.data);
            broadcastAgentsUpdated();
            return { ok: true, agent: updated };
        } catch (error) {
            return { ok: false, error: error.message || '에이전트 수정에 실패했습니다.' };
        }
    });
    ipcMain.handle('save-api-key', async (_event, payload) => {
        const provider = ensureProvider(payload?.provider);
        const key = typeof payload?.key === 'string' ? payload.key.trim() : '';
        const keyMap = {
            anthropic: 'api-key-anthropic',
            openai: 'api-key-openai',
            google: 'api-key-google',
        };
        store.set(keyMap[provider], key);
        return { ok: true };
    });
    ipcMain.handle('test-api-key', async (_event, providerRaw) => {
        try {
            const provider = ensureProvider(providerRaw);
            const apiKey = getStoredApiKey(provider);
            return apiManager.testApiKey(provider, apiKey);
        } catch (error) {
            return { ok: false, error: error.message || 'API 키 테스트에 실패했습니다.' };
        }
    });
    ipcMain.handle('load-api-keys', async () => {
        return {
            anthropic: maskApiKey(store.get('api-key-anthropic', '')),
            openai: maskApiKey(store.get('api-key-openai', '')),
            google: maskApiKey(store.get('api-key-google', '')),
        };
    });
    ipcMain.handle('save-agent-api-key', async (_event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const key = typeof payload?.key === 'string' ? payload.key.trim() : '';
            const updated = agentStore.updateAgent(agentId, { apiKey: key });
            broadcastAgentsUpdated();
            return { ok: true, agent: updated };
        } catch (error) {
            return { ok: false, error: error.message || '에이전트 API 키 저장에 실패했습니다.' };
        }
    });
    ipcMain.handle('load-agent-api-keys', async () => {
        const agents = agentStore.getAgents();
        return agents.reduce((acc, agent) => {
            acc[agent.id] = maskApiKey(agent.apiKey || '');
            return acc;
        }, {});
    });
    ipcMain.handle('get-ollama-models', async () => {
        return apiManager.getOllamaModels();
    });
    ipcMain.handle('get-theme', async () => {
        return getThemeState();
    });
    ipcMain.handle('set-theme', async (_event, mode) => {
        if (!VALID_THEME_MODES.has(mode)) {
            return { ok: false, error: '지원하지 않는 테마 모드입니다.' };
        }
        store.set('theme-mode', mode);
        const payload = getThemeState();
        BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
                win.webContents.send('system-theme-changed', payload);
            }
        });
        return { ok: true, ...payload };
    });
    ipcMain.handle('set-window-opacity', async (event, valueRaw) => {
        const value = Number(valueRaw);
        if (!Number.isFinite(value)) {
            return { ok: false, error: 'opacity 값이 올바르지 않습니다.' };
        }
        const clamped = Math.min(1, Math.max(0.2, value));
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return { ok: false, error: '창을 찾을 수 없습니다.' };
        }
        senderWindow.setOpacity(clamped);
        return { ok: true, opacity: clamped };
    });
    ipcMain.on('open-settings', () => {
        createSettingsWindow().catch((error) => {
            console.error('open-settings 처리 실패:', error);
        });
    });
    ipcMain.on('open-add-agent', (_event, agentIdRaw) => {
        const safeAgentId = typeof agentIdRaw === 'string' ? agentIdRaw.trim() : '';
        createAddAgentWindow(safeAgentId).catch((error) => {
            console.error('open-add-agent 처리 실패:', error);
        });
    });
    ipcMain.on('open-meeting', () => {
        createMeetingWindow().catch((error) => {
            console.error('open-meeting 처리 실패:', error);
        });
    });
    ipcMain.on('hide-widget', onHideWidget);
    ipcMain.on('quit-app', onQuitApp);
    registerChatMeetingHandlers({
        ipcMain,
        app,
        dialog,
        agentStore,
        apiManager,
        meetingEngine,
        createMessage,
        buildChatExportText,
        buildMeetingExportText,
        buildPersonaImprovePrompt,
        ensureAgentId,
        ensureMessageContent,
    });
}
module.exports = {
    registerIpcHandlers,
};
