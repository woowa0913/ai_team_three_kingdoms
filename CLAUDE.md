# AI Orchestra - macOS Desktop AI Orchestration Widget

## Project Overview
Electron 기반 macOS 데스크톱 위젯 앱. 여러 AI 에이전트를 개별 설정/대화하고,
"회의실"에서 다중 AI 토론을 오케스트레이션하는 시스템.

---

## ⚠️ 개발팀 구성 (Antigravity 개발 AI 팀)
> 아래는 이 앱을 **만드는** 팀의 역할이다. 앱 안의 위젯 캐릭터(삼국지)와 혼동하지 말 것.

| 역할 | AI | 페르소나 | 담당 |
|------|-----|---------|------|
| 총괄 기획·작업배분 | **Claude** | **코다리 부장** | 전체 시스템 기획, 지시, 작업 조율 |
| UI/UX 디자인 | **Gemini** | **영자** | Stitch MCP, Pencil MCP 활용 디자인 |
| 내부 시스템 코딩 | **Codex** | **번개** | 기능 구현, 백엔드/프론트엔드 코드 작성 — 빠르고 안전하게 |

- **코다리(Claude) 페르소나 전문**: `.claude/rules/kodari-persona.md` 참고
- **번개(Codex) 페르소나 전문**: `.claude/rules/bungae-persona.md` 참고
- 프로젝트 시작 시 반드시 `kodari-persona.md`를 읽고 코다리 부장 모드로 동작할 것
- Codex 작업 시작 시 반드시 `bungae-persona.md`를 읽고 번개 모드로 동작할 것

---

## 앱 내 위젯 AI 캐릭터 (삼국지 테마 - 우리가 만드는 제품)
> 아래는 앱 사용자가 대화할 AI 캐릭터들. `config/default-agents.json`에 정의됨.

| 캐릭터 | 역할 | Provider |
|--------|------|---------|
| 제갈량 | 오케스트레이터/총괄 | Google Gemini |
| 주유 | 디자인 담당 | Claude |
| 관우 | 코드 구현 | GPT-4o |
| 장비 | 디버깅 | GPT-4o-mini |
| 사마의 | 데이터/보안 | Ollama |

---

## Tech Stack
- **Runtime**: Electron 34+ (Node.js 18+)
- **Frontend**: vanilla HTML/CSS/JS 전체 통일 (창별 분리)
  - `widget.html` / `settings.html` / `add-agent.html`: 경량 vanilla JS
  - `dashboard.html` / `meeting.html`: vanilla JS (복잡도 증가 시 React 전환 재검토)
- **AI APIs**: Anthropic Claude, OpenAI GPT, Google Gemini, Ollama (로컬)
- **Design Workflow**: 영자(Gemini + Stitch MCP + Pencil MCP) → DESIGN.md + 컴포넌트 시안 → Codex가 구현
- **Architecture**: Main Process ↔ Preload (contextBridge) ↔ Renderer
- **Package**: electron-builder (macOS .app)

## Project Structure
```
ai-orchestra/
├── CLAUDE.md                    # 이 파일 (프로젝트 메모리)
├── .claude/
│   ├── agents/                  # Claude Code 서브에이전트
│   │   ├── ui-builder.md        # UI 전담 에이전트
│   │   ├── api-integrator.md    # API 연동 전담
│   │   └── orchestrator.md      # 오케스트레이션 로직 전담
│   ├── commands/                # 슬래시 커맨드
│   │   └── build-and-test.md    # 빌드+테스트 일괄
│   ├── skills/                  # 재사용 스킬
│   │   ├── orchestration/       # 오케스트레이션 패턴
│   │   └── meeting-room/        # 회의실 로직
│   └── rules/                   # 모듈형 규칙
│       ├── kodari-persona.md    # 코다리 부장 페르소나 (필수 로드)
│       ├── bungae-persona.md    # 번개(Codex) 페르소나 (필수 로드)
│       └── electron-conventions.md
├── main.js                      # Electron 메인 프로세스
├── tests/                       # Vitest 테스트
├── main/
│   ├── ipc-handlers.js          # IPC 채널 등록
│   ├── ipc-chat-meeting-handlers.js # 채팅/회의 IPC 분리
│   ├── store-config.js          # electron-store 공통 설정(암호화)
│   ├── store-utils.js           # 스토어 유틸
│   ├── store-migration.js       # 기본값 병합/마이그레이션
│   ├── chat-history.js          # 채팅 히스토리 관리
│   └── windows/                 # 창별 분리 모듈
├── preload.js                   # IPC 브릿지
├── package.json
├── renderer/
│   ├── widget.html              # 하단 AI 캐릭터 위젯
│   ├── dashboard.html           # 개별 AI 대시보드 (채팅/설정/스킬)
│   ├── meeting.html             # 회의실 (다중 AI 토론)
│   ├── settings.html            # 글로벌 설정 (API 키 등)
│   ├── styles/                  # CSS 분리
│   └── js/                      # 렌더러 JS 분리
│       ├── api-client.js        # 통합 API 클라이언트
│       ├── agent-manager.js     # 에이전트 상태 관리
│       ├── meeting-engine.js    # 회의실 오케스트레이션
│       └── characters.js        # 캐릭터 SVG/아바타
├── config/
│   └── default-agents.json      # 기본 AI 에이전트 프리셋 (삼국지 캐릭터)
└── docs/
    ├── ARCHITECTURE.md           # 아키텍처 문서
    └── API-INTEGRATION.md        # API 연동 가이드
```

## Architecture Decisions
1. **BrowserWindow per function**: widget(always-on-top), dashboard(modal), meeting(resizable)
2. **IPC 통신**: contextBridge + ipcRenderer/ipcMain (보안)
3. **API 추상화**: 통합 APIClient 클래스 → provider별 어댑터 패턴
4. **회의실 엔진**: 턴 기반 + 키워드 매칭 + 지명 발언 혼합
5. **설정 저장**: ~/Library/Application Support/ai-orchestra/config.json
6. **렌더러**: 전체 vanilla JS 통일. dashboard/meeting도 vanilla JS로 구현 완료. 상태 복잡도 증가 시 React 전환 재검토
7. **디자인 워크플로우**: 영자(Gemini+Stitch MCP+Pencil MCP) → DESIGN.md + 컴포넌트 시안 → Codex(실제 코드 구현)
8. **개발팀 역할**: 코다리=Claude(총괄기획/작업배분) / 영자=Gemini(디자인+UI) / Codex(코드 구현)

## Conventions
- 한국어 UI, 영어 코드/변수명
- `async/await` 기본, callback 금지
- IPC 채널명: `kebab-case` (예: `send-message`, `update-agent`)
- 에러 핸들링: try-catch + 사용자 토스트 알림
- 파일 분리: 단일 파일 300줄 이하 유지

## Key Commands
```bash
npm start          # 개발 모드 실행
npm run dev        # DevTools 포함 실행
npm run build      # macOS .app 빌드
npm test           # 테스트 실행
npm run test:watch # 테스트 watch
```

## Current Status
- [x] Phase 0: 프로젝트 초기화 및 스캐폴딩 완료
- [x] Phase 1: 1:1 채팅 기능 구현 완료
  - main.js (IPC 전체) / preload.js / agent-store / api-manager / window-manager
  - dashboard.html + dashboard.css (삼국지 테마) + dashboard.js (스트리밍 채팅)
  - widget.html 클릭 이벤트 연결
- [x] Phase 1.5: API 키 설정 화면 완료
  - settings.html + settings.css + settings.js
  - widget.html ⚙️ 설정 버튼 추가
- [x] Phase 2: 다중 AI 회의실 기능 구현 완료
  - [x] meeting.html + meeting.css (영자 완료)
  - [x] main/meeting-engine.js (번개 완료)
  - [x] renderer/js/meeting.js (번개 완료)
  - [x] 버그픽스 3건: script 주석해제, 더미발언 제거, speech-bubble wrapper (번개 완료)
  - [x] preload.js 회의실 IPC 리스너 전체 연결 완료
  - [x] 코다리 QA 통과 (2026-02-24)
- [x] Phase 2.5: 코드 품질 정리 완료 (번개, 2026-02-24)
  - [x] dashboard.js 중복 함수 제거 + state 객체 정리
  - [x] meeting.html 인라인 스타일 → meeting.css 이동
  - [x] widget.html 인라인 JS → widget.js 분리
  - [x] package.json start/dev 스크립트 ELECTRON_RUN_AS_NODE 충돌 수정
  - [x] npm start 정상 기동 확인
- [x] Phase 2.75: 안정성 패치 + 기능 완성 (코부장+번개, 2026-02-25)
  - [x] A-1: 크래시 진단 로깅 (uncaughtException/unhandledRejection → crash-log.txt 저장)
  - [x] A-1: app.requestSingleInstanceLock() — 중복 실행 시 기존 창 포커스 후 종료
  - [x] A-2: widgetWindow.setAlwaysOnTop(true, 'floating') — 안티그래비티 레벨 수정
  - [x] B-1: 회의 재시작 시 speech-log 초기화 (resetSpeechLog)
  - [x] B-2: 위젯 배지 동기화 — 대시보드 닫힘 시 '⚫ 대기 중' 복원 (dashboard-closed IPC)
  - [x] B-3: preload.js addSingleListener — IPC 리스너 중복 누적 방어
  - [x] C-1: 에이전트 수정 기능 — add-agent 창 편집 모드 겸용, updateAgent IPC 추가
  - [x] C-1: 위젯 에이전트 아이콘 우클릭 → 수정 창 열기
  - [x] C-2: Ollama 연결 실패 시 명확한 오류 메시지 ("localhost:11434 확인해주세요")
- [x] Phase 2.8: 삼국지 치비(SD) 테마 디자인 개편 (영자, 2026-02-25)
  - [x] Stitch MCP 기반 Chibi Chat Dashboard 시안 도출 및 에셋 확보
  - [x] themes.css 전면 개편 (피치/크림/골드 파스텔 라운드 톤)
  - [x] dashboard.css 오리엔탈 배경, 만두 모양 버튼, 라운드 말풍선 등 세부 적용 완료
  - [x] widget.css 아이콘 및 버튼 원형(border-radius: 50%) 처리
- [~] Phase 3: E2E 통합 테스트 + 배포 준비 (진행 중, 2026-02-25)
  - [x] 거대 파일 리팩터링(코드 분리)
    - [x] `main/agent-store.js` → `chat-history.js`, `store-migration.js`, `store-utils.js` 분리
    - [x] `main/window-manager.js` → `main/windows/*.js` 창별 분리
    - [x] `main.js` IPC 핸들러 분리(`main/ipc-handlers.js`, `main/ipc-chat-meeting-handlers.js`)
    - [x] `main/api-manager.js` → `api-shared.js` + `api-providers/*` 분리 (인터페이스 유지)
  - [x] 테스트 프레임워크 구축 (Vitest)
    - [x] `tests/meeting-engine.test.js`
    - [x] `tests/api-manager.test.js`
    - [x] `tests/agent-store.test.js`
    - [x] `tests/ipc-handlers.integration.test.js`
  - [x] 보안 하드닝
    - [x] Store 암호화 옵션 공통화(`store-config.js`)
    - [x] IPC 입력 검증(`agentId`, `provider`, 메시지 길이)
    - [x] BrowserWindow 보안 옵션 강화(`sandbox: true`, `contextIsolation: true`)
    - [x] 외부 URL 로딩 차단(`will-navigate`, `setWindowOpenHandler`)
  - [~] 빌드 설정/패키징
    - [x] `package.json` electron-builder 설정 보완(appId/productName/mac target/dmg background)
    - [x] `.app` 산출 확인 (`dist/mac-arm64/AI Orchestra.app`)
    - [x] `.zip` 산출 확인 (`dist/AI Orchestra-1.0.0-arm64-mac.zip`)
    - [x] DMG 실패 fallback 적용: `mac.target`을 `zip` 단독으로 전환하여 `npm run build` 성공

- [x] Phase 4: UX 개선 및 개별 API 키 기능 적용 완료 (2026-02-25)
  - [x] Sprint 1: 장막 서브메뉴(팝업) UI 완비 (CSS/JS)
  - [x] Sprint 2: 대시보드 UI 폴리싱 (에러 메시지 말풍선, 헤더 투명도 슬라이더, 테마 선택 버튼 고도화)
  - [x] Sprint 3: 다중 AI 회의실 UX 업그레이드 (사용자 발언과 AI 발언 구분, 개별 패널, 슬라이드업 효과 적용)
  - [x] Sprint 4: 에이전트별(개별/전역) API 키 저장 분리 및 설정 창 카드형 UI 100% 반영
- [~] Phase 4.5: 위젯 리디자인/진입점 보강 (진행 중, 2026-02-25)
  - [x] 위젯 서브메뉴 변경 이후 대시보드 헤더에 `⚙️ 설정` / `＋ 추가` 진입 버튼 복원
  - [ ] 캐릭터 정사각 PNG(800x800) 및 본진(`fortress.png`) 에셋 교체
  - [ ] 최신 실앱 스크린샷 4종 갱신(`docs/screenshots`)
## Important Notes
- 위젯 고정: `alwaysOnTop: true` (생성 옵션) + `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` + `setAlwaysOnTop(true, 'floating')` (macOS level 지정 필수 — 미지정 시 fullscreen/Spaces 전환에서 소멸)
- 회의실 AI 응답은 순차 스트리밍 (동시 아님, UX 혼란 방지)
- API 키는 electron-store로 암호화 저장
- 캐릭터별 system prompt는 config/default-agents.json에서 관리
- **VSCode/Claude Code에서 실행 시**: `ELECTRON_RUN_AS_NODE=1` 환경변수 충돌 주의
  - package.json에 `env -u ELECTRON_RUN_AS_NODE electron .` 적용 완료
  - 이 변수가 설정된 상태로 `electron .` 실행 시 `app is undefined` 오류 발생
- Phase 3 현재 빌드 상태: DMG만 실패, `.app`/`.zip`는 생성 완료
