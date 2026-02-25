const fs = require('fs');
const path = require('path');
const { createDashboardWindow: createDashboardWindowInternal } = require('./windows/dashboard-window');
const { createSettingsWindow: createSettingsWindowInternal } = require('./windows/settings-window');
const { createMeetingWindow: createMeetingWindowInternal } = require('./windows/meeting-window');
const { createAddAgentWindow: createAddAgentWindowInternal } = require('./windows/add-agent-window');

const dashboardWindows = new Map();
let settingsWindow = null;
let meetingWindow = null;
let addAgentWindow = null;

async function createDashboardWindow(agentId, onClosed) {
    if (!agentId || typeof agentId !== 'string') {
        return null;
    }

    const existingWindow = dashboardWindows.get(agentId);
    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
    }

    const dashboardWindow = await createDashboardWindowInternal(agentId, () => {
        dashboardWindows.delete(agentId);
        if (typeof onClosed === 'function') {
            onClosed(agentId);
        }
    });
    dashboardWindows.set(agentId, dashboardWindow);
    return dashboardWindow;
}

async function createSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return settingsWindow;
    }
    settingsWindow = await createSettingsWindowInternal(() => {
        settingsWindow = null;
    });
    return settingsWindow;
}

async function createMeetingWindow() {
    if (meetingWindow && !meetingWindow.isDestroyed()) {
        meetingWindow.focus();
        return meetingWindow;
    }
    meetingWindow = await createMeetingWindowInternal(() => {
        meetingWindow = null;
    });
    return meetingWindow;
}

async function createAddAgentWindow(agentId = '') {
    if (addAgentWindow && !addAgentWindow.isDestroyed()) {
        const safeAgentId = typeof agentId === 'string' ? agentId : '';
        const query = safeAgentId ? { agentId: safeAgentId } : undefined;
        const addAgentPath = path.join(__dirname, '..', 'renderer', 'add-agent.html');
        if (fs.existsSync(addAgentPath)) {
            addAgentWindow.loadFile(addAgentPath, query ? { query } : undefined)
                .catch((error) => {
                    console.error('에이전트 추가창 리로드 실패:', error);
                });
        }
        addAgentWindow.focus();
        return addAgentWindow;
    }
    addAgentWindow = await createAddAgentWindowInternal(agentId, () => {
        addAgentWindow = null;
    });
    return addAgentWindow;
}

module.exports = {
    createDashboardWindow,
    createSettingsWindow,
    createMeetingWindow,
    createAddAgentWindow,
};
