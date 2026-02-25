const { app, BrowserWindow, ipcMain, screen, Tray, nativeImage, nativeTheme, dialog, globalShortcut } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Store = require('electron-store');
const { getStoreOptions } = require('./main/store-config');
const { createDashboardWindow, createSettingsWindow, createMeetingWindow, createAddAgentWindow } = require('./main/window-manager');
const { registerIpcHandlers } = require('./main/ipc-handlers');
const { buildChatExportText, buildMeetingExportText } = require('./main/export-utils');
const { registerProcessErrorHandlers, createMessage, buildPersonaImprovePrompt } = require('./main/runtime-utils');
const agentStore = require('./main/agent-store');
const apiManager = require('./main/api-manager');
const meetingEngine = require('./main/meeting-engine');

const store = new Store(getStoreOptions());
let widgetWindow;
let tray;

const CRASH_LOG_PATH = path.join(os.homedir(), 'Library', 'Application Support', 'ai-orchestra', 'crash-log.txt');
const PRIMARY_WIDGET_SHORTCUT = 'CommandOrControl+Shift+Space';
const FALLBACK_WIDGET_SHORTCUT = 'Alt+Space';
const isDevMode = process.argv.includes('--dev');

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

registerProcessErrorHandlers({ app, dialog, crashLogPath: CRASH_LOG_PATH });

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.exit(0);
}

function getWidgetBounds() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const agents = agentStore.getAgents();
    const width = (agents.length + 1) * 110 + 80;
    const height = 240;
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

function loadTrayIcon() {
    const tray1xPath = path.join(__dirname, 'build', 'tray-icon.png');
    const tray2xPath = path.join(__dirname, 'build', 'tray-icon@2x.png');
    if (fs.existsSync(tray1xPath) || fs.existsSync(tray2xPath)) {
        return nativeImage.createFromPath(tray2xPath && fs.existsSync(tray2xPath) ? tray2xPath : tray1xPath);
    }

    const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAM1BMVEUAAP/////n2rrFq2FqVVyCgYK4sW+7rFJrY2NnWlyqqqpTUE5nWlyromGNi1utn1Y8OjtNAAAAD3RSTlMA8A0e8PMxr6mhg3dQWx22AAAAQ0lEQVR4nGNgYGBkYmZhY2NnYGRiY2MHEkYGFiA2MDAwMHAwMjA0MQARRhYQYWBmYmFg4ODh4eHi4uLiQMSABAwAX4QDP9R4BMEAAAAASUVORK5CYII=';
    return nativeImage.createFromDataURL(iconDataUrl);
}

function createTrayIcon() {
    if (tray) {
        return tray;
    }

    tray = new Tray(loadTrayIcon());
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
            sandbox: true,
        },
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: true,
        resizable: false,
        x: bounds.x,
        y: bounds.y,
    });

    widgetWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    widgetWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });

    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    widgetWindow.setAlwaysOnTop(true, 'floating');

    /* 투명 영역 클릭 투과: 마우스 이동만 전달, 클릭은 아래 창으로 통과 */
    widgetWindow.setIgnoreMouseEvents(true, { forward: true });

    widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
    widgetWindow.once('ready-to-show', () => {
        if (!widgetWindow.isDestroyed()) {
            widgetWindow.show();
        }
    });

    if (isDevMode) {
        widgetWindow.webContents.openDevTools({ mode: 'detach' });
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

    /* 위젯 투명 영역 마우스 투과 토글 */
    ipcMain.on('set-ignore-mouse-events', (_event, ignore) => {
        if (!widgetWindow || widgetWindow.isDestroyed()) {
            return;
        }
        if (ignore) {
            widgetWindow.setIgnoreMouseEvents(true, { forward: true });
        } else {
            widgetWindow.setIgnoreMouseEvents(false);
        }
    });

    registerIpcHandlers({
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
        onHideWidget: () => {
            if (!widgetWindow || widgetWindow.isDestroyed()) {
                return;
            }
            widgetWindow.hide();
        },
        onQuitApp: () => {
            app.quit();
        },
    });

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
