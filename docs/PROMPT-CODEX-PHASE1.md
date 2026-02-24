# Codex에게 보내는 Phase 1 구현 작업 지시서

---

## 당신의 역할
당신은 **Codex**, 이 팀의 코드 구현 담당입니다.
기획(코다리)과 디자인(영자)의 산출물을 바탕으로 실제 동작하는 코드를 작성합니다.
영자의 디자인(dashboard.html, dashboard.css)이 준비되면 합체하여 완성합니다.

---

## 프로젝트 컨텍스트

**앱**: AI Orchestra — macOS Electron 위젯 앱
**Tech**: Electron 34+, Node.js, vanilla HTML/CSS/JS (dashboard는 vanilla 사용)
**현재 완성된 파일**:
- `main.js` — widgetWindow 생성, `get-agents` IPC만 존재
- `preload.js` — `getAgents`, `openDashboard`, `openMeetingRoom` 노출
- `renderer/widget.html` — agent 클릭 시 console.log만 (연결 필요)
- `config/default-agents.json` — 5개 에이전트 정의

---

## Phase 1 구현 작업 목록

### [작업 1] `main/agent-store.js` 신규 생성
electron-store를 사용한 에이전트 및 대화 기록 관리 모듈.

```javascript
// 구현할 함수들
getAgents()                    // 전체 에이전트 목록 반환
getAgent(agentId)              // 단일 에이전트 반환
getChatHistory(agentId)        // 대화 기록 배열 반환 (Message 객체 배열)
appendMessage(agentId, message) // 대화 기록에 메시지 추가
clearHistory(agentId)          // 대화 기록 초기화
```

**Message 객체 구조**:
```json
{
  "id": "msg-{Date.now()}",
  "role": "user" | "assistant",
  "content": "텍스트",
  "timestamp": 1700000000000,
  "agentId": "agent-1"
}
```

저장 키: `agents` (기본값: default-agents.json), `chat-history-{agentId}`

---

### [작업 2] `main/api-manager.js` 신규 생성
Provider별 API 어댑터 + 스트리밍 응답 처리.

**지원 Provider**:
| Provider | 모델 예시 | API Key 저장 키 |
|----------|----------|---------------|
| anthropic | claude-3-7-sonnet-20250219 | `api-key-anthropic` |
| openai | gpt-4o, gpt-4o-mini | `api-key-openai` |
| google | gemini-2.0-flash | `api-key-google` |
| ollama | llama-3 (로컬) | 불필요 (localhost:11434) |

**핵심 함수**:
```javascript
// messages: Message 배열, persona: 에이전트 system prompt
// onChunk: (chunk: string) => void  스트리밍 청크 콜백
// onEnd: () => void
// onError: (error: Error) => void
async streamChat(provider, model, persona, messages, onChunk, onEnd, onError)
```

**스트리밍 구현 방식**:
- Anthropic: `@anthropic-ai/sdk` 또는 fetch + SSE
- OpenAI: `openai` 패키지 또는 fetch + SSE
- Google: `@google/generative-ai` 패키지
- Ollama: `fetch('http://localhost:11434/api/chat', { stream: true })`

**API 키 로드**: `electron-store`에서 읽기. 없으면 Error throw.

---

### [작업 3] `main.js` 수정
기존 파일에 아래 내용 추가:

```javascript
// 추가할 import
const { createDashboardWindow } = require('./main/window-manager');
const agentStore = require('./main/agent-store');
const apiManager = require('./main/api-manager');

// 추가할 IPC 핸들러들
ipcMain.on('open-dashboard', (event, agentId) => { ... })
ipcMain.handle('get-agent', async (event, agentId) => { ... })
ipcMain.handle('get-chat-history', async (event, agentId) => { ... })
ipcMain.handle('clear-history', async (event, agentId) => { ... })
ipcMain.handle('send-message', async (event, { agentId, content }) => {
  // 1. user 메시지 저장
  // 2. API 스트리밍 시작
  // 3. onChunk → event.sender.send('stream-chunk', { chunk })
  // 4. onEnd → 전체 응답 저장 후 event.sender.send('stream-end')
  // 5. onError → event.sender.send('stream-error', { message })
})
```

---

### [작업 4] `main/window-manager.js` 신규 생성
BrowserWindow 생성 로직 분리.

```javascript
// 대시보드 창 생성 (agentId별 하나씩)
function createDashboardWindow(agentId) {
  // 이미 열려있으면 포커스
  // 없으면 새 BrowserWindow 생성
  // 크기: 480 × 700
  // frame: true (닫기 버튼 있음)
  // URL: renderer/dashboard.html?agentId={agentId}
}
```

---

### [작업 5] `preload.js` 수정
채팅 관련 IPC 추가:

```javascript
sendMessage: (agentId, content) => ipcRenderer.invoke('send-message', { agentId, content }),
getAgent: (agentId) => ipcRenderer.invoke('get-agent', agentId),
getChatHistory: (agentId) => ipcRenderer.invoke('get-chat-history', agentId),
clearHistory: (agentId) => ipcRenderer.invoke('clear-history', agentId),
onStreamChunk: (callback) => ipcRenderer.on('stream-chunk', (_, data) => callback(data)),
onStreamEnd: (callback) => ipcRenderer.on('stream-end', () => callback()),
onStreamError: (callback) => ipcRenderer.on('stream-error', (_, data) => callback(data)),
removeStreamListeners: () => {
  ipcRenderer.removeAllListeners('stream-chunk');
  ipcRenderer.removeAllListeners('stream-end');
  ipcRenderer.removeAllListeners('stream-error');
}
```

---

### [작업 6] `renderer/js/dashboard.js` 신규 생성
대시보드 채팅 로직 (영자의 dashboard.html에 연결됨).

```javascript
// 초기화: URL 파라미터에서 agentId 파싱
// 에이전트 정보 로드 → 헤더 렌더링
// 대화 기록 로드 → 메시지 목록 렌더링
// 메시지 전송: textarea에서 Enter 감지 → sendMessage 호출
// 스트리밍: onStreamChunk → 현재 assistant 버블에 텍스트 append
// onStreamEnd → .streaming 클래스 제거, 기록 저장
// onStreamError → 에러 토스트 표시
// 페이지 언로드 시 removeStreamListeners 호출
```

---

### [작업 7] `renderer/widget.html` 수정
기존 `console.log('Clicked:', agent.name)` 부분을:
```javascript
window.electronAPI.openDashboard(agent.id);
```
로 교체.

---

## 코딩 컨벤션
- `async/await` 사용, callback 금지
- 모든 try-catch에서 에러 로깅 + 사용자 알림
- 단일 파일 300줄 이하
- 변수명/함수명: camelCase (영어)
- 주석: 한국어로 핵심 로직 설명

---

## 참고할 공유 스펙
`docs/PHASE1-SPEC.md`의 전체 내용을 숙지하고,
특히 섹션 3 (IPC 채널 목록)과 섹션 6 (API Provider) 기준으로 구현하세요.

---

## 납품 순서 권장 (병렬 가능)
1. `main/agent-store.js` (영자 작업과 완전 독립)
2. `main/api-manager.js` (영자 작업과 완전 독립)
3. `main/window-manager.js` (영자 작업과 완전 독립)
4. `main.js` + `preload.js` 수정 (1~3 완료 후)
5. `renderer/js/dashboard.js` (영자의 dashboard.html 납품 후 합체)
6. `renderer/widget.html` 수정 (언제든 가능)

작업 1~4, 6은 영자 디자인을 기다리지 않고 즉시 시작 가능합니다.
