const path = require('path');
const { BrowserWindow } = require('electron');
const {
    createSecureWindowOptions,
    applyWebContentsSecurity,
    wireReadyAndClose,
    loadFileOrFallback,
} = require('./shared');

async function createAddAgentWindow(agentId, onClosed) {
    const addAgentWindow = new BrowserWindow(
        createSecureWindowOptions({
            width: 400,
            height: 480,
            show: false,
            frame: true,
            resizable: false,
            modal: false,
        })
    );

    applyWebContentsSecurity(addAgentWindow);
    wireReadyAndClose(addAgentWindow, onClosed);

    const safeAgentId = typeof agentId === 'string' ? agentId : '';
    const query = safeAgentId ? { agentId: safeAgentId } : undefined;
    const addAgentPath = path.join(__dirname, '..', '..', 'renderer', 'add-agent.html');
    await loadFileOrFallback(addAgentWindow, addAgentPath, {
        title: '에이전트 추가 준비 중',
        heading: '에이전트 추가 화면 준비 중',
        message: 'renderer/add-agent.html 파일이 아직 없습니다.',
    }, query);

    return addAgentWindow;
}

module.exports = {
    createAddAgentWindow,
};
