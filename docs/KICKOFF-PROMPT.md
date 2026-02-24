# AI Orchestra - Claude Code 킥오프 프롬프트

## 페르소나: Maestro (마에스트로)

당신은 Claude Code에서 동작하는 "Maestro" — AI 오케스트레이션 시스템 아키텍트입니다.

---

## 🎯 Phase 0: 프로젝트 초기화 프롬프트

아래를 Claude Code에 첫 프롬프트로 입력하세요:

```
나는 macOS 데스크톱 위젯 형태의 AI 오케스트레이션 앱 "AI Orchestra"를 만들고 있어.

## 프로젝트 컨셉
- Electron 기반 macOS 데스크톱 앱
- 화면 하단에 여러 AI 에이전트가 위젯으로 상주
- 각 AI를 클릭하면 1:1 채팅 가능 (대시보드)
- "회의실"에 여러 AI를 불러서 주제에 대해 토론시킬 수 있음
- 각 AI는 다른 API/모델 사용 가능 (Claude, GPT, Gemini, Ollama)
- 에이전트별 페르소나, 전문분야, 말투를 설정 가능

## 현재 상태
- CLAUDE.md, 서브에이전트, 스킬, 규칙 파일은 이미 세팅됨
- config/default-agents.json에 기본 에이전트 5명 정의됨
- docs/ARCHITECTURE.md에 아키텍처 정리됨

## 이번 작업 요청
Phase 0: 프로젝트 스캐폴딩을 해줘.

1. package.json 생성 (electron, electron-builder, electron-store 의존성)
2. main.js 기본 구조 (WindowManager 패턴)
3. preload.js (IPC 채널 정의)
4. renderer/widget.html (하단 위젯 - 5명 캐릭터 표시)
5. 기본 CSS 스타일 (macOS 네이티브 느낌 다크테마)

먼저 CLAUDE.md와 docs/ARCHITECTURE.md를 읽고,
.claude/agents/의 서브에이전트들과 .claude/skills/를 확인한 후 작업해줘.
각 파일은 300줄 이하로 유지하고, 모듈 분리해서 작성해줘.
```

---

## 🚀 Phase 1: 핵심 기능 프롬프트

```
Phase 1: 1:1 채팅 기능을 구현해줘.

1. renderer/dashboard.html - 개별 AI 대시보드
   - 채팅 탭: 메시지 입력 → API 호출 → 스트리밍 응답 표시
   - 설정 탭: AI의 페르소나, 모델, API 키 편집
   - 스킬 탭: AI의 전문분야, 키워드 확인
2. main/api-manager.js - 통합 API 클라이언트
   - Claude, OpenAI 어댑터 우선 구현
   - 스트리밍 응답 처리
3. main/agent-store.js - 에이전트 상태 관리
   - 대화 기록 저장 (electron-store)
   - 에이전트 설정 CRUD

api-integrator 서브에이전트에게 API 연동 부분을 위임해줘.
ui-builder 서브에이전트에게 대시보드 UI를 위임해줘.
```

---

## 🏢 Phase 2: 회의실 프롬프트

```
Phase 2: 회의실(Meeting Room) 기능을 구현해줘.

1. renderer/meeting.html - 회의실 UI
   - .claude/skills/meeting-room/SKILL.md의 레이아웃 스펙 참고
   - 참석자 선택/제거, 발언 순서 드래그, 회의 규칙 설정
2. main/meeting-engine.js - 오케스트레이션 엔진
   - .claude/skills/orchestration/SKILL.md 패턴 참고
   - 키워드 기반 자동 발언자 선정
   - 순차 스트리밍 응답
   - 회의 요약 생성
3. 위젯에 회의실 버튼 추가

orchestrator 서브에이전트에게 MeetingEngine 구현을 위임해줘.
```

---

## ⚙️ Phase 3: 설정 및 고도화 프롬프트

```
Phase 3: 설정 화면과 고도화 기능을 구현해줘.

1. renderer/settings.html - 글로벌 설정
   - API 키 관리 (provider별)
   - 기본 모델 선택
   - 테마 설정 (다크/라이트)
2. 에이전트 추가/삭제/편집 기능
3. 회의 기록 저장 및 내보내기 (마크다운)
4. 시스템 트레이 통합
5. 단축키: Cmd+Shift+H (앱 토글)

/build-and-test 커맨드로 전체 검증해줘.
```

---

## 💡 작업 팁

### 서브에이전트 활용
- UI 작업: "ui-builder 에이전트에게 위임해줘"
- API 작업: "api-integrator 에이전트에게 위임해줘"  
- 회의실: "orchestrator 에이전트에게 위임해줘"

### Context 관리
- 작업이 길어지면: `/clear` 후 "CLAUDE.md 읽고 이어서 작업해줘"
- 진행 상황: "현재 상태를 CLAUDE.md의 Current Status에 업데이트해줘"

### 디버깅
- `npm run dev`로 DevTools 확인
- 에러 발생 시: "콘솔 로그를 확인하고 수정해줘"

### 빌드
- `/build-and-test`로 일괄 검증
- `npm run build`로 .app 생성
