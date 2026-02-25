const fs = require('fs');
const path = require('path');

const APP_PRELOAD_PATH = path.join(__dirname, '..', '..', 'preload.js');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createSecureWindowOptions(windowOptions = {}) {
    const basePreferences = {
        preload: APP_PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
    };

    return {
        ...windowOptions,
        webPreferences: {
            ...basePreferences,
            ...(windowOptions.webPreferences || {}),
        },
    };
}

function applyWebContentsSecurity(window) {
    if (!window || window.isDestroyed()) {
        return;
    }

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });
}

function wireReadyAndClose(window, onClosed) {
    window.once('ready-to-show', () => {
        if (!window.isDestroyed()) {
            window.show();
        }
    });

    window.on('closed', () => {
        if (typeof onClosed === 'function') {
            onClosed();
        }
    });
}

async function loadFileOrFallback(window, filePath, fallbackConfig, query) {
    if (fs.existsSync(filePath)) {
        await window.loadFile(filePath, query ? { query } : undefined);
        return;
    }

    const html = [
        '<!doctype html>',
        '<html lang="ko"><head><meta charset="UTF-8">',
        `<title>${escapeHtml(fallbackConfig.title)}</title></head>`,
        '<body style="font-family: sans-serif; background: #1d1d1d; color: #ececec; padding: 24px;">',
        `<h2>${escapeHtml(fallbackConfig.heading)}</h2>`,
        `<p>${escapeHtml(fallbackConfig.message)}</p>`,
        ...(Array.isArray(fallbackConfig.extraLines)
            ? fallbackConfig.extraLines.map((line) => `<p>${escapeHtml(line)}</p>`)
            : []),
        '</body></html>',
    ].join('');

    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

module.exports = {
    createSecureWindowOptions,
    applyWebContentsSecurity,
    wireReadyAndClose,
    loadFileOrFallback,
};
