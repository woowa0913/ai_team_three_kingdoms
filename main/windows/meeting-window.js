const path = require('path');
const { BrowserWindow } = require('electron');
const {
    createSecureWindowOptions,
    applyWebContentsSecurity,
    wireReadyAndClose,
    loadFileOrFallback,
} = require('./shared');

async function createMeetingWindow(onClosed) {
    const meetingWindow = new BrowserWindow(
        createSecureWindowOptions({
            width: 720,
            height: 600,
            minWidth: 600,
            minHeight: 480,
            show: false,
            frame: true,
            resizable: true,
        })
    );

    applyWebContentsSecurity(meetingWindow);
    wireReadyAndClose(meetingWindow, onClosed);

    const meetingPath = path.join(__dirname, '..', '..', 'renderer', 'meeting.html');
    await loadFileOrFallback(meetingWindow, meetingPath, {
        title: '회의실 준비 중',
        heading: '회의실 화면 준비 중',
        message: 'renderer/meeting.html 파일이 아직 없습니다.',
    });

    return meetingWindow;
}

module.exports = {
    createMeetingWindow,
};
