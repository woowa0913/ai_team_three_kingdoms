const { app, BrowserWindow, ipcMain, screen, Tray, nativeImage, nativeTheme } = require('electron');
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
app.whenReady().then(() => {
    createWidgetWindow();
    createTrayIcon();
    nativeTheme.on('updated', broadcastSystemThemeChanged);
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWidgetWindow();
        }
    });
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
ipcMain.on('open-dashboard', (event, agentId) => {
    try {
        if (!agentStore.getAgent(agentId)) {
            throw new Error('에이전트를 찾을 수 없습니다.');
        }
        const dashboardWindow = createDashboardWindow(agentId);
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
ipcMain.on('open-add-agent', () => {
    createAddAgentWindow();
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
