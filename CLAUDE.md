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
- **Frontend**: 하이브리드 (창별 분리)
  - `widget.html`: vanilla HTML/CSS/JS (경량, 항상 표시)
  - `dashboard.html`, `meeting.html`: React + Vite (복잡한 상태 관리)
  - `settings.html`: vanilla HTML/CSS/JS
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
6. **하이브리드 렌더러**: widget/settings → vanilla JS (경량), dashboard/meeting → React (복잡도 대응)
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
```

## Current Status
- [x] Phase 0: 프로젝트 초기화 및 스캐폴딩 완료
- [x] Phase 1: 1:1 채팅 기능 완료
  - main.js (IPC 전체) / preload.js / agent-store / api-manager / window-manager
  - dashboard.html + dashboard.css (삼국지 테마) + dashboard.js (스트리밍 채팅)
  - widget.html 클릭 이벤트 연결
- [x] Phase 1.5: API 키 설정 화면 완료
  - settings.html + settings.css + settings.js
  - widget.html ⚙️ 설정 버튼 추가
- [x] Phase 2: 회의실 (다중 AI 토론) 완료
  - [x] meeting.html + meeting.css (영자 완료)
  - [x] main/meeting-engine.js (번개 완료)
  - [x] renderer/js/meeting.js (번개 완료)
  - [x] 버그픽스 3건: script 주석해제, 더미발언 제거, speech-bubble wrapper (번개 완료)
  - [x] preload.js 회의실 IPC 리스너 전체 연결 완료
  - [x] 코다리 QA 통과 (2026-02-24)
- [ ] Phase 3: E2E 통합 테스트 + 배포 준비

## Important Notes
- Electron의 `alwaysOnTop` + `setVisibleOnAllWorkspaces` 로 위젯 고정
- 회의실 AI 응답은 순차 스트리밍 (동시 아님, UX 혼란 방지)
- API 키는 electron-store로 암호화 저장
- 캐릭터별 system prompt는 config/default-agents.json에서 관리
