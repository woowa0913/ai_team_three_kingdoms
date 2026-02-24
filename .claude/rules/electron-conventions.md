---
globs:
  - "main.js"
  - "preload.js"
  - "renderer/**"
---

# Electron Development Rules

## Security
- nodeIntegration: false (항상)
- contextIsolation: true (항상)
- 렌더러→메인 통신은 반드시 preload.js의 contextBridge 경유
- 절대 `remote` 모듈 사용 금지
- API 키는 렌더러에 노출 금지 → 메인 프로세스에서만 API 호출

## IPC Patterns
```javascript
// preload.js - 허용된 채널만 노출
contextBridge.exposeInMainWorld('api', {
  sendMessage: (agentId, msg) => ipcRenderer.invoke('send-message', agentId, msg),
  onStreamChunk: (cb) => ipcRenderer.on('stream-chunk', (_, data) => cb(data)),
});

// main.js - 핸들러
ipcMain.handle('send-message', async (event, agentId, msg) => { ... });
```

## Window Management
- widget: `alwaysOnTop: true, frame: false, transparent: true`
- dashboard: `frame: false, titleBarStyle: 'hiddenInset'`
- meeting: `frame: false, titleBarStyle: 'hiddenInset', resizable: true`
- 모든 윈도우: `webPreferences: { preload: path.join(__dirname, 'preload.js') }`

## File Size
- 단일 JS 파일 300줄 이하
- 단일 HTML 파일 200줄 이하
- 기능별 모듈 분리 필수
