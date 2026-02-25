const path = require('path');
const { BrowserWindow } = require('electron');
const {
    createSecureWindowOptions,
    applyWebContentsSecurity,
    wireReadyAndClose,
    loadFileOrFallback,
} = require('./shared');

async function createSettingsWindow(onClosed) {
    const settingsWindow = new BrowserWindow(
        createSecureWindowOptions({
            width: 480,
            height: 520,
            resizable: false,
            show: false,
            frame: true,
        })
    );

    applyWebContentsSecurity(settingsWindow);
    wireReadyAndClose(settingsWindow, onClosed);

    const settingsPath = path.join(__dirname, '..', '..', 'renderer', 'settings.html');
    await loadFileOrFallback(settingsWindow, settingsPath, {
        title: '설정 준비 중',
        heading: '설정 화면 준비 중',
        message: 'renderer/settings.html 파일이 아직 없습니다.',
    });

    return settingsWindow;
}

module.exports = {
    createSettingsWindow,
};
