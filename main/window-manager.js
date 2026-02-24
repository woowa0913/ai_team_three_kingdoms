const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

const dashboardWindows = new Map();
let settingsWindow = null;
let meetingWindow = null;

function createDashboardWindow(agentId) {
    if (!agentId || typeof agentId !== 'string') {
        return null;
    }

    const existingWindow = dashboardWindows.get(agentId);
    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
    }

    const dashboardWindow = new BrowserWindow({
        width: 480,
        height: 700,
        minWidth: 420,
        minHeight: 560,
        show: false,
        frame: true,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    dashboardWindows.set(agentId, dashboardWindow);

    dashboardWindow.once('ready-to-show', () => {
        if (!dashboardWindow.isDestroyed()) {
            dashboardWindow.show();
        }
    });

    dashboardWindow.on('closed', () => {
        dashboardWindows.delete(agentId);
    });

    const dashboardPath = path.join(__dirname, '..', 'renderer', 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        dashboardWindow.loadFile(dashboardPath, { query: { agentId } }).catch((error) => {
            console.error('대시보드 파일 로드 실패:', error);
        });
    } else {
        const fallbackHtml = [
            '<!doctype html>',
            '<html lang="ko"><head><meta charset="UTF-8"><title>Dashboard 준비 중</title></head>',
            '<body style="font-family: sans-serif; background: #1d1d1d; color: #ececec; padding: 24px;">',
            '<h2>대시보드 UI 준비 중</h2>',
            '<p>renderer/dashboard.html 파일이 아직 없습니다.</p>',
            `<p>agentId: ${agentId}</p>`,
            '</body></html>',
        ].join('');
        dashboardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`).catch((error) => {
            console.error('대시보드 대체 페이지 로드 실패:', error);
        });
    }

    return dashboardWindow;
}

function createSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return settingsWindow;
    }

    settingsWindow = new BrowserWindow({
        width: 480,
        height: 520,
        resizable: false,
        show: false,
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    settingsWindow.once('ready-to-show', () => {
        if (!settingsWindow.isDestroyed()) {
            settingsWindow.show();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });

    const settingsPath = path.join(__dirname, '..', 'renderer', 'settings.html');
    if (fs.existsSync(settingsPath)) {
        settingsWindow.loadFile(settingsPath).catch((error) => {
            console.error('설정창 로드 실패:', error);
        });
    } else {
        const fallbackHtml = [
            '<!doctype html>',
            '<html lang="ko"><head><meta charset="UTF-8"><title>설정 준비 중</title></head>',
            '<body style="font-family: sans-serif; background: #1d1d1d; color: #ececec; padding: 24px;">',
            '<h2>설정 화면 준비 중</h2>',
            '<p>renderer/settings.html 파일이 아직 없습니다.</p>',
            '</body></html>',
        ].join('');
        settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`).catch((error) => {
            console.error('설정창 대체 페이지 로드 실패:', error);
        });
    }

    return settingsWindow;
}

function createMeetingWindow() {
    if (meetingWindow && !meetingWindow.isDestroyed()) {
        meetingWindow.focus();
        return meetingWindow;
    }

    meetingWindow = new BrowserWindow({
        width: 720,
        height: 600,
        minWidth: 600,
        minHeight: 480,
        show: false,
        frame: true,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    meetingWindow.once('ready-to-show', () => {
        if (!meetingWindow.isDestroyed()) {
            meetingWindow.show();
        }
    });

    meetingWindow.on('closed', () => {
        meetingWindow = null;
    });

    const meetingPath = path.join(__dirname, '..', 'renderer', 'meeting.html');
    if (fs.existsSync(meetingPath)) {
        meetingWindow.loadFile(meetingPath).catch((error) => {
            console.error('회의실 파일 로드 실패:', error);
        });
    } else {
        const fallbackHtml = [
            '<!doctype html>',
            '<html lang="ko"><head><meta charset="UTF-8"><title>회의실 준비 중</title></head>',
            '<body style="font-family: sans-serif; background: #1d1d1d; color: #ececec; padding: 24px;">',
            '<h2>회의실 화면 준비 중</h2>',
            '<p>renderer/meeting.html 파일이 아직 없습니다.</p>',
            '</body></html>',
        ].join('');
        meetingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`).catch((error) => {
            console.error('회의실 대체 페이지 로드 실패:', error);
        });
    }

    return meetingWindow;
}

module.exports = {
    createDashboardWindow,
    createSettingsWindow,
    createMeetingWindow,
};
