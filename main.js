const { app, BrowserWindow, ipcMain, screen, Tray, nativeImage, nativeTheme, dialog, globalShortcut } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Store = require('electron-store');
const { createDashboardWindow, createSettingsWindow, createMeetingWindow, createAddAgentWindow } = require('./main/window-manager');
const agentStore = require('./main/agent-store');
const apiManager = require('./main/api-manager');
const meetingEngine = require('./main/meeting-engine');
const store = new Store();
let widgetWindow;
let tray;
let meetingSessionId = 0;
let meetingSender = null;
let isMeetingLoopRunning = false;

const CRASH_LOG_PATH = path.join(os.homedir(), 'Library', 'Application Support', 'ai-orchestra', 'crash-log.txt');
const PRIMARY_WIDGET_SHORTCUT = 'CommandOrControl+Shift+Space';
const FALLBACK_WIDGET_SHORTCUT = 'Alt+Space';

function formatExportDate(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatExportTime(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function buildChatExportText(agent, history) {
    const agentName = agent?.name || '에이전트';
    const lines = [
        `[${agentName}] 대화 기록 (${formatExportDate()})`,
        '───────────────────────',
    ];

    history.forEach((message) => {
        const roleLabel = message.role === 'assistant' ? agentName : 'User';
        lines.push(`[${roleLabel}] ${formatExportTime(message.timestamp)}`);
        lines.push(message.content || '');
        lines.push('');
    });

    lines.push('───────────────────────');
    return lines.join('\n');
}

function buildMeetingExportText(meetingState) {
    const topic = meetingState?.topic || '회의 주제 미기재';
    const lines = [
        `[작전 회의실] 회의 기록 (${formatExportDate()})`,
        `주제: ${topic}`,
        '───────────────────────',
    ];

    (meetingState?.history || []).forEach((speech) => {
        lines.push(`[${speech.agentName || '알 수 없는 화자'}] ${formatExportTime(speech.timestamp)}`);
        lines.push(speech.content || '');
        lines.push('');
    });

    lines.push('───────────────────────');
    return lines.join('\n');
}

function toggleWidgetVisibility() {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        createWidgetWindow();
        return;
    }

    if (widgetWindow.isVisible()) {
        widgetWindow.hide();
        return;
    }

    widgetWindow.show();
    widgetWindow.focus();
}

function registerWidgetShortcut() {
    let registered = false;
    try {
        registered = globalShortcut.register(PRIMARY_WIDGET_SHORTCUT, toggleWidgetVisibility);
    } catch (error) {
        console.warn(`전역 단축키 등록 실패 (${PRIMARY_WIDGET_SHORTCUT}):`, error);
    }

    if (registered) {
        return;
    }

    console.warn(`전역 단축키 등록 실패: ${PRIMARY_WIDGET_SHORTCUT}, 대체 키를 시도합니다.`);
    try {
        const fallbackRegistered = globalShortcut.register(FALLBACK_WIDGET_SHORTCUT, toggleWidgetVisibility);
        if (!fallbackRegistered) {
            console.warn(`대체 전역 단축키 등록 실패: ${FALLBACK_WIDGET_SHORTCUT}`);
        }
    } catch (error) {
        console.warn(`대체 전역 단축키 등록 중 예외 (${FALLBACK_WIDGET_SHORTCUT}):`, error);
    }
}

function getStoredApiKey(provider) {
    const keyMap = {
        anthropic: 'api-key-anthropic',
        openai: 'api-key-openai',
        google: 'api-key-google',
    };
    const storeKey = keyMap[provider];
    if (!storeKey) {
        return '';
    }
    const key = store.get(storeKey, '');
    return typeof key === 'string' ? key.trim() : '';
}

function serializeError(errorLike) {
    if (errorLike instanceof Error) {
        return errorLike.stack || errorLike.message || String(errorLike);
    }
    if (typeof errorLike === 'string') {
        return errorLike;
    }
    try {
        return JSON.stringify(errorLike);
    } catch (_error) {
        return String(errorLike);
    }
}

function appendCrashLog(type, errorLike) {
    const timestamp = new Date().toISOString();
    const payload = serializeError(errorLike);
    const entry = `[${timestamp}] [${type}]\n${payload}\n\n`;

    try {
        fs.mkdirSync(path.dirname(CRASH_LOG_PATH), { recursive: true });
        fs.appendFileSync(CRASH_LOG_PATH, entry, 'utf8');
    } catch (error) {
        console.error('크래시 로그 저장 실패:', error);
    }
}

process.on('unhandledRejection', (reason) => {
    appendCrashLog('unhandledRejection', reason);
});

process.on('uncaughtException', (error) => {
    const details = serializeError(error);
    try {
        dialog.showErrorBox('AI Orchestra 오류', details.slice(0, 2000));
    } catch (_dialogError) {
        // Dialog 호출 실패 시에도 종료 전 로그는 남긴다.
    }
    appendCrashLog('uncaughtException', error);
    app.exit(1);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.exit(0);
}

function getWidgetBounds() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const agents = agentStore.getAgents();
    const width = Math.max(400, agents.length * 96 + 120);
    const height = 140;
    const x = Math.max(0, Math.floor((screenWidth - width) / 2));
    const y = screenHeight - height - 20;
    return { width, height, x, y };
}

function syncWidgetBounds() {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        return;
    }
    const { width, height, x, y } = getWidgetBounds();
    widgetWindow.setBounds({ width, height, x, y });
}

function broadcastAgentsUpdated() {
    const agents = agentStore.getAgents();
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('agents-updated', { agents });
    }
}

function broadcastDashboardClosed(agentId) {
    if (!agentId) {
        return;
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('dashboard-closed', { agentId });
    }
}

function getThemeState() {
    const savedRaw = store.get('theme-mode', 'system');
    const saved = ['dark', 'light', 'system'].includes(savedRaw) ? savedRaw : 'system';
    const systemIsDark = nativeTheme.shouldUseDarkColors;
    const effective = saved === 'system' ? (systemIsDark ? 'dark' : 'light') : saved;
    return { saved, systemIsDark, effective };
}

function broadcastSystemThemeChanged() {
    const payload = getThemeState();
    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
            win.webContents.send('system-theme-changed', payload);
        }
    });
}

function createTrayIcon() {
    if (tray) {
        return tray;
    }

    const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAM1BMVEUAAP/////n2rrFq2FqVVyCgYK4sW+7rFJrY2NnWlyqqqpTUE5nWlyromGNi1utn1Y8OjtNAAAAD3RSTlMA8A0e8PMxr6mhg3dQWx22AAAAQ0lEQVR4nGNgYGBkYmZhY2NnYGRiY2MHEkYGFiA2MDAwMHAwMjA0MQARRhYQYWBmYmFg4ODh4eHi4uLiQMSABAwAX4QDP9R4BMEAAAAASUVORK5CYII=';
    const icon = nativeImage.createFromDataURL(iconDataUrl);
    tray = new Tray(icon);
    tray.setToolTip('AI Orchestra');
    tray.on('click', () => {
        if (!widgetWindow || widgetWindow.isDestroyed()) {
            createWidgetWindow();
            return;
        }
        widgetWindow.show();
        widgetWindow.focus();
    });

    return tray;
}
function createWidgetWindow() {
    const bounds = getWidgetBounds();

    widgetWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        frame: false, // Borderless window for widget feel
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        x: bounds.x,
        y: bounds.y,
    });
    // Keep widget visible on all workspaces (macOS)
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    widgetWindow.setAlwaysOnTop(true, 'floating');
    widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
    widgetWindow.once('ready-to-show', () => {
        if (!widgetWindow.isDestroyed()) {
            widgetWindow.show();
        }
    });
    // Open the DevTools if started with --dev
    if (process.argv.includes('--dev')) {
        widgetWindow.webContents.openDevTools({ mode: 'detach' });
    }
}
function createMessage(role, content, agentId) {
    return {
        id: `msg-${Date.now()}`,
        role,
        content,
        timestamp: Date.now(),
        agentId,
    };
}

function buildPersonaImprovePrompt(agent, instruction) {
    const lines = [
        `대상 에이전트: ${agent.name}`,
        `현재 페르소나:`,
        agent.persona || '(없음)',
        '',
        `사용자 지시: ${instruction}`,
        '',
        '요구사항:',
        '- 지시를 반영한 개선된 페르소나만 출력',
        '- 설명/서론/불릿 없이 최종 페르소나 본문만 출력',
        '- 한국어로 출력',
    ];
    return lines.join('\n');
}
function safeSendToMeeting(channel, payload) {
    if (!meetingSender || meetingSender.isDestroyed()) {
        return;
    }
    meetingSender.send(channel, payload);
}
async function runMeetingLoop(sessionId) {
    if (isMeetingLoopRunning) {
        return;
    }
    isMeetingLoopRunning = true;
    try {
        while (sessionId === meetingSessionId) {
            const nextTurn = meetingEngine.getNextTurnContext();
            if (!nextTurn) {
                break;
            }
            const agent = agentStore.getAgent(nextTurn.agentId);
            if (!agent) {
                meetingEngine.appendSpeech({ id: nextTurn.agentId, name: nextTurn.agentId }, '에이전트 정보를 찾을 수 없습니다.');
                continue;
            }
            safeSendToMeeting('meeting-speaker-start', {
                agentId: agent.id,
                agentName: agent.name,
                round: nextTurn.round,
            });
            let fullContent = '';
            try {
                await apiManager.streamChat(
                    agent.provider,
                    agent.model,
                    agent.persona,
                    nextTurn.messages,
                    (chunk) => {
                        fullContent += chunk;
                        safeSendToMeeting('meeting-chunk', { chunk });
                    },
                    () => { },
                    () => { }
                );
            } catch (error) {
                console.error('회의 발언 스트리밍 실패:', error);
                fullContent = fullContent || `오류: ${error.message || '응답 생성 실패'}`;
            }
            const speech = meetingEngine.appendSpeech(agent, fullContent);
            safeSendToMeeting('meeting-speaker-end', {
                agentId: speech.agentId,
                content: speech.content,
            });
        }
    } finally {
        isMeetingLoopRunning = false;
        safeSendToMeeting('meeting-ended');
    }
}
app.on('second-instance', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        if (widgetWindow.isMinimized()) {
            widgetWindow.restore();
        }
        widgetWindow.show();
        widgetWindow.focus();
        return;
    }
    createWidgetWindow();
});

console.log('[BOOT] app ready 진입');
app.whenReady().then(() => {
    createWidgetWindow();
    createTrayIcon();
    registerWidgetShortcut();
    nativeTheme.on('updated', broadcastSystemThemeChanged);
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWidgetWindow();
        }
    });
});
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
ipcMain.handle('get-agents', async () => {
    return agentStore.getAgents();
});
ipcMain.handle('add-agent', async (_event, agentData) => {
    try {
        const created = agentStore.addAgent(agentData);
        syncWidgetBounds();
        broadcastAgentsUpdated();
        return { ok: true, agent: created };
    } catch (error) {
        return { ok: false, error: error.message || '에이전트 추가에 실패했습니다.' };
    }
});
ipcMain.handle('delete-agent', async (_event, agentId) => {
    try {
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
        const updatedAgents = agentStore.reorderAgent(payload?.agentId, payload?.direction);
        broadcastAgentsUpdated();
        return { ok: true, agents: updatedAgents };
    } catch (error) {
        return { ok: false, error: error.message || '에이전트 순서 변경에 실패했습니다.' };
    }
});
ipcMain.on('open-dashboard', (event, agentId) => {
    try {
        if (!agentStore.getAgent(agentId)) {
            throw new Error('에이전트를 찾을 수 없습니다.');
        }
        const dashboardWindow = createDashboardWindow(agentId, broadcastDashboardClosed);
        if (
            dashboardWindow &&
            process.argv.includes('--dev') &&
            !dashboardWindow.webContents.isDevToolsOpened()
        ) {
            dashboardWindow.webContents.openDevTools({ mode: 'detach' });
        }
    } catch (error) {
        console.error('open-dashboard 처리 실패:', error);
        if (!event.sender.isDestroyed()) {
            event.sender.send('stream-error', {
                message: error.message || '대시보드 창을 열지 못했습니다.',
            });
        }
    }
});
ipcMain.handle('get-agent', async (_event, agentId) => {
    return agentStore.getAgent(agentId);
});
ipcMain.handle('get-chat-history', async (_event, agentId) => {
    return agentStore.getChatHistory(agentId);
});
ipcMain.handle('clear-history', async (_event, agentId) => {
    agentStore.clearHistory(agentId);
    return { ok: true };
});
ipcMain.handle('update-agent-persona', async (_event, payload) => {
    try {
        const updated = agentStore.updateAgentPersona(payload?.agentId, payload?.persona);
        broadcastAgentsUpdated();
        return { ok: true, agent: updated };
    } catch (error) {
        return { ok: false, error: error.message || '페르소나 저장에 실패했습니다.' };
    }
});
ipcMain.handle('update-agent', async (_event, payload) => {
    try {
        const updated = agentStore.updateAgent(payload?.agentId, payload?.data);
        broadcastAgentsUpdated();
        return { ok: true, agent: updated };
    } catch (error) {
        return { ok: false, error: error.message || '에이전트 수정에 실패했습니다.' };
    }
});
ipcMain.handle('ai-improve-persona', async (event, payload) => {
    try {
        const agentId = payload?.agentId;
        const instruction = typeof payload?.instruction === 'string' ? payload.instruction.trim() : '';
        if (!agentId) {
            throw new Error('agentId가 필요합니다.');
        }
        if (!instruction) {
            throw new Error('개선 지시를 입력해주세요.');
        }

        const targetAgent = agentStore.getAgent(agentId);
        if (!targetAgent) {
            throw new Error('대상 에이전트를 찾을 수 없습니다.');
        }

        const orchestrator = agentStore.getAgent('agent-1');
        if (!orchestrator) {
            throw new Error('오케스트레이터(agent-1)를 찾을 수 없습니다.');
        }

        const systemPrompt = '현재 페르소나를 보고 사용자 지시에 따라 개선된 페르소나 텍스트만 반환해줘.';
        const messages = [{ role: 'user', content: buildPersonaImprovePrompt(targetAgent, instruction) }];
        let suggestion = '';

        await apiManager.streamChat(
            orchestrator.provider,
            orchestrator.model,
            systemPrompt,
            messages,
            (chunk) => {
                suggestion += chunk;
                if (!event.sender.isDestroyed()) {
                    event.sender.send('persona-stream-chunk', { chunk });
                }
            },
            () => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('persona-stream-end');
                }
            },
            () => { }
        );

        return { ok: true, suggestion: suggestion.trim() };
    } catch (error) {
        if (!event.sender.isDestroyed()) {
            event.sender.send('persona-stream-error', {
                message: error.message || '페르소나 AI 개선에 실패했습니다.',
            });
        }
        return { ok: false, error: error.message || '페르소나 AI 개선에 실패했습니다.' };
    }
});
ipcMain.handle('save-api-key', async (_event, payload) => {
    const provider = payload?.provider;
    const key = typeof payload?.key === 'string' ? payload.key.trim() : '';
    const keyMap = {
        anthropic: 'api-key-anthropic',
        openai: 'api-key-openai',
        google: 'api-key-google',
    };
    const storeKey = keyMap[provider];
    if (!storeKey) {
        throw new Error('지원하지 않는 provider입니다.');
    }
    store.set(storeKey, key);
    return { ok: true };
});
ipcMain.handle('test-api-key', async (_event, provider) => {
    const normalizedProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
    if (!normalizedProvider) {
        return { ok: false, error: 'provider가 필요합니다.' };
    }
    const apiKey = getStoredApiKey(normalizedProvider);
    return apiManager.testApiKey(normalizedProvider, apiKey);
});
ipcMain.handle('load-api-keys', async () => {
    const mask = (key) => {
        if (!key || key.length < 8) {
            return key ? '****' : '';
        }
        return `${key.slice(0, 4)}****${key.slice(-4)}`;
    };
    return {
        anthropic: mask(store.get('api-key-anthropic', '')),
        openai: mask(store.get('api-key-openai', '')),
        google: mask(store.get('api-key-google', '')),
    };
});
ipcMain.handle('get-ollama-models', async () => {
    return apiManager.getOllamaModels();
});
ipcMain.handle('get-theme', async () => {
    return getThemeState();
});
ipcMain.handle('set-theme', async (_event, mode) => {
    if (!['dark', 'light', 'system'].includes(mode)) {
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
ipcMain.on('open-settings', () => {
    createSettingsWindow();
});
ipcMain.on('open-add-agent', (_event, agentId) => {
    createAddAgentWindow(typeof agentId === 'string' ? agentId : '');
});
ipcMain.on('open-meeting', () => {
    createMeetingWindow();
});
ipcMain.on('hide-widget', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        return;
    }
    widgetWindow.hide();
});
ipcMain.on('quit-app', () => {
    app.quit();
});
ipcMain.handle('start-meeting', async (event, payload) => {
    try {
        if (isMeetingLoopRunning) {
            throw new Error('이미 회의가 진행 중입니다.');
        }
        const topic = payload?.topic;
        const participantIds = payload?.participantIds;
        const maxRounds = payload?.maxRounds;
        const state = meetingEngine.startMeeting(topic, participantIds, maxRounds);
        meetingSessionId += 1;
        meetingSender = event.sender;
        runMeetingLoop(meetingSessionId).catch((error) => {
            console.error('회의 루프 처리 실패:', error);
            safeSendToMeeting('meeting-ended');
        });
        return { ok: true, state };
    } catch (error) {
        return { ok: false, error: error.message || '회의 시작에 실패했습니다.' };
    }
});
ipcMain.handle('stop-meeting', async () => {
    const state = meetingEngine.stopMeeting();
    return { ok: true, state };
});
ipcMain.handle('get-meeting-state', async () => {
    return meetingEngine.getState();
});
ipcMain.handle('export-chat', async (_event, payload) => {
    try {
        const agentId = payload?.agentId;
        const agent = agentStore.getAgent(agentId);
        if (!agent) {
            throw new Error('에이전트를 찾을 수 없습니다.');
        }
        const history = agentStore.getChatHistory(agentId);
        const defaultFileName = `${agent.name}-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        const result = await dialog.showSaveDialog({
            title: '대화 기록 내보내기',
            defaultPath: path.join(app.getPath('documents'), defaultFileName),
            filters: [{ name: 'Text', extensions: ['txt'] }],
        });

        if (result.canceled || !result.filePath) {
            return { ok: false, canceled: true };
        }

        const content = buildChatExportText(agent, history);
        fs.writeFileSync(result.filePath, content, 'utf8');
        return { ok: true, filePath: result.filePath };
    } catch (error) {
        return { ok: false, error: error.message || '대화 기록 내보내기에 실패했습니다.' };
    }
});
ipcMain.handle('export-meeting', async () => {
    try {
        const meetingState = meetingEngine.getState();
        const history = Array.isArray(meetingState?.history) ? meetingState.history : [];
        if (history.length === 0) {
            return { ok: false, error: '내보낼 회의 기록이 없습니다.' };
        }

        const defaultFileName = `meeting-${new Date().toISOString().slice(0, 10)}.txt`;
        const result = await dialog.showSaveDialog({
            title: '회의 기록 내보내기',
            defaultPath: path.join(app.getPath('documents'), defaultFileName),
            filters: [{ name: 'Text', extensions: ['txt'] }],
        });

        if (result.canceled || !result.filePath) {
            return { ok: false, canceled: true };
        }

        const content = buildMeetingExportText(meetingState);
        fs.writeFileSync(result.filePath, content, 'utf8');
        return { ok: true, filePath: result.filePath };
    } catch (error) {
        return { ok: false, error: error.message || '회의 기록 내보내기에 실패했습니다.' };
    }
});
ipcMain.handle('send-message', async (event, payload) => {
    try {
        const agentId = payload?.agentId;
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
        if (!agentId) {
            throw new Error('agentId가 필요합니다.');
        }
        if (!content) {
            throw new Error('메시지 내용을 입력해주세요.');
        }
        const agent = agentStore.getAgent(agentId);
        if (!agent) {
            throw new Error('에이전트 정보를 찾을 수 없습니다.');
        }
        const userMessage = createMessage('user', content, agentId);
        agentStore.appendMessage(agentId, userMessage);
        const history = agentStore.getChatHistory(agentId);
        let assistantContent = '';
        await apiManager.streamChat(
            agent.provider,
            agent.model,
            agent.persona,
            history,
            (chunk) => {
                assistantContent += chunk;
                if (!event.sender.isDestroyed()) {
                    event.sender.send('stream-chunk', { chunk });
                }
            },
            () => { },
            () => { }
        );
        const finalAssistantContent = assistantContent.trim();
        if (finalAssistantContent) {
            const assistantMessage = createMessage('assistant', finalAssistantContent, agentId);
            agentStore.appendMessage(agentId, assistantMessage);
        }
        if (!event.sender.isDestroyed()) {
            event.sender.send('stream-end');
        }
        return { ok: true };
    } catch (error) {
        console.error('send-message 처리 실패:', error);
        if (!event.sender.isDestroyed()) {
            event.sender.send('stream-error', {
                message: error.message || '응답 생성 중 오류가 발생했습니다.',
            });
        }
        return {
            ok: false,
            error: error.message || '응답 생성 중 오류가 발생했습니다.',
        };
    }
});
