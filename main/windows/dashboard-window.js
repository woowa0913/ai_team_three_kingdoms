const path = require('path');
const { BrowserWindow } = require('electron');
const {
    createSecureWindowOptions,
    applyWebContentsSecurity,
    wireReadyAndClose,
    loadFileOrFallback,
} = require('./shared');

async function createDashboardWindow(agentId, onClosed) {
    const dashboardWindow = new BrowserWindow(
        createSecureWindowOptions({
            width: 480,
            height: 700,
            minWidth: 420,
            minHeight: 560,
            show: false,
            frame: true,
            resizable: true,
        })
    );

    applyWebContentsSecurity(dashboardWindow);
    wireReadyAndClose(dashboardWindow, onClosed);

    const dashboardPath = path.join(__dirname, '..', '..', 'renderer', 'dashboard.html');
    await loadFileOrFallback(
        dashboardWindow,
        dashboardPath,
        {
            title: 'Dashboard 준비 중',
            heading: '대시보드 UI 준비 중',
            message: 'renderer/dashboard.html 파일이 아직 없습니다.',
            extraLines: [`agentId: ${agentId}`],
        },
        { agentId }
    );

    return dashboardWindow;
}

module.exports = {
    createDashboardWindow,
};
