# ⚡ 번개에게 — Phase 2 지시서 (빠른 픽스 + 회의실 엔진)

> 코다리 부장 QA 결과 기반 발령. 즉시 착수.

---

## 🔧 [긴급 픽스 2건] — 먼저 처리하고 회의실로 넘어올 것

### 픽스 1: settings.js — 눈 토글 이모지 미반영

`renderer/js/settings.js`의 `bindToggleVisibility` 함수에서
`input.type` 토글 시 버튼 텍스트(이모지)도 변경해야 함.

```javascript
// 기존 코드 (96~98번 줄 근처):
const isPassword = input.type === 'password';
input.type = isPassword ? 'text' : 'password';
button.setAttribute('aria-pressed', String(isPassword));

// 수정 후 — 아래 1줄 추가:
button.textContent = isPassword ? '🙈' : '👁️';
```
- 비밀번호 표시 중(text): `🙈` (눈 가린 원숭이 = "보이면 안 돼!")
- 비밀번호 숨김 중(password): `👁️` (눈 = "클릭하면 보여줘")

### 픽스 2: widget.css — `.actions` gap 누락

`renderer/styles/widget.css`의 `.actions` 클래스에 버튼 간격 추가:

```css
/* 기존 */
.actions {
  display: flex;
  -webkit-app-region: no-drag;
}

/* 수정 후 */
.actions {
  display: flex;
  gap: 8px;             /* ← 이거 추가 */
  align-items: center;  /* ← 이거 추가 */
  -webkit-app-region: no-drag;
}
```

---

## [작업 1] `main/meeting-engine.js` 신규 생성

회의실 오케스트레이션 상태 머신.

### 상태 정의
```
IDLE → STARTED → SPEAKING → WAITING → ENDED
```

### 구현할 핵심 로직

```javascript
// 상태 관리
const state = {
    status: 'IDLE',           // 현재 상태
    topic: '',                 // 회의 주제
    participants: [],          // 참여 에이전트 ID 배열
    history: [],               // 전체 발언 기록
    currentRound: 0,          // 현재 라운드
    maxRounds: 3,              // 최대 라운드 (설정 가능)
    currentSpeakerIndex: 0,   // 현재 발언자 인덱스
};

// 외부에서 호출할 함수들
startMeeting(topic, participantIds, maxRounds)  // 회의 시작
stopMeeting()                                    // 회의 중단
getState()                                       // 현재 상태 반환
```

### 발언자 선정 알고리즘 (라운드로빈 기본)
1. `participants` 배열 순서대로 돌아가며 발언
2. 한 라운드 = 모든 참여자 1회 발언
3. `maxRounds` 완료 시 자동 종료

### Context 빌딩
각 에이전트 발언 전:
```
system: {에이전트 persona}
messages: [
  { role: 'user', content: '회의 주제: {topic}' },
  ...history의 이전 발언들을 user/assistant 교대로 변환...
]
```
발언 기록을 API messages로 변환할 때:
- 현재 발언자의 이전 발언 → `assistant`
- 다른 참여자 발언 → `user` (화자 이름 prefix 붙임: "관우: 내용...")

### IPC 이벤트 (main.js에서 연결)
`meeting-engine.js`는 순수 로직만. IPC 핸들러는 main.js에서 별도 추가.

---

## [작업 2] `main.js` — 회의실 IPC 핸들러 추가

```javascript
// 회의 시작
ipcMain.handle('start-meeting', async (event, { topic, participantIds, maxRounds }) => { ... })

// 회의 중단
ipcMain.handle('stop-meeting', async () => { ... })

// 회의 상태 조회
ipcMain.handle('get-meeting-state', async () => { ... })

// 회의실 창 열기 (open-settings 패턴과 동일)
ipcMain.on('open-meeting', () => {
    const { createMeetingWindow } = require('./main/window-manager');
    createMeetingWindow();
});
```

회의 진행 중 각 발언 스트리밍:
- 발언 시작: `event.sender.send('meeting-speaker-start', { agentId, agentName, round })`
- 청크: `event.sender.send('meeting-chunk', { chunk })`
- 발언 완료: `event.sender.send('meeting-speaker-end', { agentId, content })`
- 회의 종료: `event.sender.send('meeting-ended')`

---

## [작업 3] `main/window-manager.js` — createMeetingWindow 추가

```javascript
let meetingWindow = null;

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
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // ... loadFile('renderer/meeting.html'), ready-to-show, closed 패턴 동일
}
```

---

## [작업 4] `preload.js` — 회의실 IPC 추가

```javascript
startMeeting: (topic, participantIds, maxRounds) =>
    ipcRenderer.invoke('start-meeting', { topic, participantIds, maxRounds }),
stopMeeting: () => ipcRenderer.invoke('stop-meeting'),
getMeetingState: () => ipcRenderer.invoke('get-meeting-state'),
onMeetingSpeakerStart: (cb) => ipcRenderer.on('meeting-speaker-start', (_, d) => cb(d)),
onMeetingChunk: (cb) => ipcRenderer.on('meeting-chunk', (_, d) => cb(d)),
onMeetingSpeakerEnd: (cb) => ipcRenderer.on('meeting-speaker-end', (_, d) => cb(d)),
onMeetingEnded: (cb) => ipcRenderer.on('meeting-ended', () => cb()),
removeMeetingListeners: () => {
    ['meeting-speaker-start','meeting-chunk','meeting-speaker-end','meeting-ended']
        .forEach(ch => ipcRenderer.removeAllListeners(ch));
},
```

---

## [작업 5] `renderer/js/meeting.js` 신규 생성

영자의 meeting.html 완성 후 연결. 아래 클래스명 기준으로 작성:
- `.meeting-topic-input` — 주제 입력창
- `.participant-list` — 참여자 체크박스 목록
- `.btn-start-meeting` — 회의 시작 버튼
- `.btn-stop-meeting` — 회의 중단 버튼
- `.speech-log` — 발언 기록 컨테이너
- `.speech-item` — 개별 발언 (에이전트명 + 내용)
- `.speech-item.streaming` — 스트리밍 중 발언

---

## 완료 보고 형식

```
⚡ 번개 보고 — Phase 2

✅ [완료 목록]
  └─ settings.js 눈 이모지 토글 수정
  └─ widget.css actions gap 추가
  └─ meeting-engine.js 생성
  └─ main.js 회의실 IPC 핸들러 추가
  └─ window-manager.js createMeetingWindow 추가
  └─ preload.js 회의실 IPC 추가
  └─ meeting.js 로직 파일 생성

⚠️ [영자 대기]
  └─ meeting.html 납품 후 meeting.js 클래스명 최종 확인 필요

🛑 [블로커 / 특이사항]
  └─ (있으면 기재)
```
