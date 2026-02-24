# AI Orchestra - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                   macOS Desktop                      │
│                                                     │
│  ┌─── Electron Main Process ───────────────────┐   │
│  │                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │   │
│  │  │ Window   │  │ API      │  │ Config    │  │   │
│  │  │ Manager  │  │ Manager  │  │ Store     │  │   │
│  │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │   │
│  │       │              │              │         │   │
│  │  ┌────┴──────────────┴──────────────┴─────┐  │   │
│  │  │           IPC Bridge (preload.js)       │  │   │
│  │  └────┬──────────────┬──────────────┬─────┘  │   │
│  └───────┼──────────────┼──────────────┼────────┘   │
│          │              │              │             │
│  ┌───────┴───┐  ┌──────┴─────┐  ┌────┴────────┐   │
│  │  Widget   │  │ Dashboard  │  │  Meeting    │   │
│  │ (하단바)  │  │ (1:1 채팅) │  │  (회의실)   │   │
│  └───────────┘  └────────────┘  └─────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
          │              │              │
          └──────────────┴──────────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
       ┌────┴───┐  ┌────┴───┐  ┌────┴───┐
       │ Claude │  │ OpenAI │  │ Gemini │  ...
       │  API   │  │  API   │  │  API   │
       └────────┘  └────────┘  └────────┘
```

## Data Flow

### 1:1 채팅
```
User Input → Renderer IPC → Main Process → API Provider → Stream Response → IPC → Renderer Update
```

### 회의실 토론
```
User Topic → Meeting Engine → Select Speakers → 
  For each speaker:
    Build Context (persona + history + topic) →
    API Call (speaker's provider) →
    Stream Response to UI →
    Append to Meeting History →
  Loop until max rounds or user stops
```

## Key Components

### WindowManager (main.js)
- 위젯, 대시보드, 회의실 윈도우 생명주기 관리
- 위젯: alwaysOnTop, 투명 배경, 프레임 없음
- 대시보드: 캐릭터 클릭 시 생성/포커스
- 회의실: 싱글톤 (하나만 열림)

### APIManager (main/api-manager.js)
- Provider별 어댑터 관리
- 스트리밍 응답 → IPC 청크 전달
- API 키 검증 및 모델 목록 조회

### MeetingEngine (main/meeting-engine.js)
- 회의 상태 머신: IDLE → STARTED → SPEAKING → WAITING → ENDED
- 발언자 선정 알고리즘 (키워드/라운드로빈/지명)
- Context 윈도우 관리 (토큰 제한 고려)

### AgentStore (main/agent-store.js)
- 에이전트 CRUD
- 대화 기록 저장/로드
- 설정 영속화 (electron-store)

## File Naming Convention
- Main process: `main/{module-name}.js`
- Renderer: `renderer/{view-name}.html`, `renderer/js/{module}.js`
- Styles: `renderer/styles/{view-name}.css`
- Config: `config/{name}.json`
