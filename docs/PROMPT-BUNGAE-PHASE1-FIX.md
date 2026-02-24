# ⚡ 번개에게 — Phase 1 버그픽스 + Phase 2 기반 작업 지시서

> 코다리 부장 발령. 즉시 착수할 것.

---

## 🚨 [긴급] 버그 픽스 — CSS 클래스 불일치

### 문제
`renderer/js/dashboard.js`와 `renderer/styles/dashboard.css`의 클래스명이 불일치.
현재 앱 실행 시 채팅 버블에 스타일이 전혀 적용되지 않는 상태.

| JS가 생성하는 클래스 | CSS에 정의된 클래스 | 상태 |
|------------------|-----------------|------|
| `message-content` | `msg-bubble`, `msg-content` | ❌ 불일치 |
| `message-timestamp` | `timestamp` | ❌ 불일치 |

### 수정 방향
**`dashboard.css`를 JS 기준으로 맞출 것** (JS 로직이 더 복잡하므로 CSS 쪽 수정이 안전)

`dashboard.css`에서 다음 4곳 수정:
1. `.msg-bubble` → `.message-content`
2. `.message.user .msg-bubble` → `.message.user .message-content`
3. `.message.assistant .msg-bubble` → `.message.assistant .message-content`
4. `.message.streaming .msg-content::after` → `.message.streaming .message-content::after`
5. `.timestamp` → `.message-timestamp`
6. `.message.user .timestamp` → `.message.user .message-timestamp`
7. `border-radius: varying;` (43번 줄) → 삭제 (유효하지 않은 CSS값)

---

## [작업 1] `main.js` + `preload.js` — API 키 관련 IPC 추가

### main.js에 추가할 핸들러

```javascript
// API 키 저장
ipcMain.handle('save-api-key', async (_event, { provider, key }) => {
    const keyMap = {
        anthropic: 'api-key-anthropic',
        openai: 'api-key-openai',
        google: 'api-key-google',
    };
    const storeKey = keyMap[provider];
    if (!storeKey) throw new Error('지원하지 않는 provider입니다.');
    store.set(storeKey, key.trim());
    return { ok: true };
});

// API 키 로드 (마스킹해서 반환)
ipcMain.handle('load-api-keys', async () => {
    const mask = (key) => {
        if (!key || key.length < 8) return key ? '****' : '';
        return key.slice(0, 4) + '****' + key.slice(-4);
    };
    return {
        anthropic: mask(store.get('api-key-anthropic', '')),
        openai: mask(store.get('api-key-openai', '')),
        google: mask(store.get('api-key-google', '')),
    };
});

// 설정창 열기
ipcMain.on('open-settings', () => {
    const { createSettingsWindow } = require('./main/window-manager');
    createSettingsWindow();
});
```

> ⚠️ main.js 상단의 `const Store = require('electron-store');` + `const store = new Store();`가
> 현재 삭제됐을 수 있음. agent-store.js의 store 인스턴스와 별도로 main.js에서도 store가 필요하므로
> 상단에 추가할 것.

### preload.js에 추가할 메서드

```javascript
saveApiKey: (provider, key) => ipcRenderer.invoke('save-api-key', { provider, key }),
loadApiKeys: () => ipcRenderer.invoke('load-api-keys'),
openSettings: () => ipcRenderer.send('open-settings'),
```

---

## [작업 2] `main/window-manager.js` — createSettingsWindow 추가

기존 `createDashboardWindow` 아래에 추가:

```javascript
let settingsWindow = null;

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
        if (!settingsWindow.isDestroyed()) settingsWindow.show();
    });

    settingsWindow.on('closed', () => { settingsWindow = null; });

    settingsWindow.loadFile(
        path.join(__dirname, '..', 'renderer', 'settings.html')
    ).catch((err) => console.error('설정창 로드 실패:', err));

    return settingsWindow;
}

module.exports = { createDashboardWindow, createSettingsWindow };
```

---

## [작업 3] `renderer/js/settings.js` 신규 생성

설정창 로직. 영자가 settings.html 완성하면 연결됨.

```javascript
// 구현할 기능:
// 1. 초기화: loadApiKeys() → 각 입력창에 마스킹된 값 표시
// 2. 저장 버튼 클릭: 각 provider별 saveApiKey() 호출
//    - 입력값이 비어있거나 '****' 패턴이면 저장 스킵 (기존 키 유지)
//    - 새 값 입력된 경우만 저장
// 3. 저장 완료 토스트 표시 후 창 닫기
// 4. 취소 버튼: 그냥 window.close()

// UI 셀렉터 기준 (영자 settings.html 클래스명과 맞출 것):
// [data-provider="anthropic"] input
// [data-provider="openai"] input
// [data-provider="google"] input
// .btn-save / .btn-cancel
```

---

## [작업 4] `renderer/widget.html` — 설정 버튼 추가

기존 `.actions` 영역의 `btn-meeting` 버튼 앞에 설정 버튼 추가:

```html
<button id="btn-settings" class="btn-settings" title="설정">⚙️</button>
```

JS 이벤트:
```javascript
document.getElementById('btn-settings').addEventListener('click', () => {
    window.electronAPI.openSettings();
});
```

---

## 완료 보고 형식

모든 작업 완료 후 코다리 부장에게 아래 형식으로 보고할 것:

```
⚡ 번개 보고 — Phase 1 버그픽스 + Phase 2 기반

✅ [완료된 작업 목록]
  └─ dashboard.css 클래스 불일치 수정 완료
  └─ main.js API 키 IPC 핸들러 추가
  └─ preload.js 메서드 추가
  └─ window-manager.js createSettingsWindow 추가
  └─ settings.js 로직 파일 생성
  └─ widget.html 설정 버튼 추가

⚠️ [영자 작업 대기 항목]
  └─ settings.html 마크업 납품 후 settings.js 클래스명 최종 연결 필요

🛑 [블로커 / 특이사항]
  └─ (있으면 기재)
```
