# 🎵 AI Orchestra

macOS 데스크톱 위젯으로 여러 AI 에이전트를 오케스트레이션하는 앱

## 컨셉

화면 하단에 AI 팀원들이 상주하며, 개별 채팅과 다중 AI 토론(회의실)을 지원합니다.

## 시작하기

### 1. 프로젝트 셋업
```bash
git clone <your-repo>
cd ai-orchestra
```

### 2. Claude Code로 빌드
```bash
claude
# → docs/KICKOFF-PROMPT.md의 Phase 0 프롬프트 입력
```

### 3. 개발 실행
```bash
npm install
npm run dev
```

## 프로젝트 구조

```
ai-orchestra/
├── CLAUDE.md              # Claude Code 프로젝트 메모리
├── .claude/
│   ├── agents/            # 서브에이전트 (ui-builder, api-integrator, orchestrator)
│   ├── commands/          # 슬래시 커맨드 (/build-and-test)
│   ├── skills/            # 스킬 (orchestration, meeting-room)
│   └── rules/             # 규칙 (electron-conventions)
├── config/
│   └── default-agents.json  # AI 에이전트 프리셋 (5명)
├── docs/
│   ├── ARCHITECTURE.md    # 시스템 아키텍처
│   └── KICKOFF-PROMPT.md  # Claude Code 작업 프롬프트 (Phase 0~3)
├── main.js                # Electron 메인 프로세스
├── preload.js             # IPC 브릿지
└── renderer/              # UI (widget, dashboard, meeting, settings)
```

## AI 에이전트 (기본 프리셋)

| 이름 | 역할 | API | 특징 |
|------|------|-----|------|
| 🧠 전략가 | 비즈니스 전략 | Claude | 분석적, 데이터 기반 |
| 💻 개발자 | 풀스택 개발 | Claude | 실용적, 코드 중심 |
| 🎨 디자이너 | UX/UI 디자인 | GPT-4o | 사용자 중심, 시각적 |
| 📋 PM | 프로덕트 관리 | Claude | 체계적, 우선순위 명확 |
| 🔬 리서처 | AI/기술 리서치 | Gemini | 학술적, 근거 기반 |

## 주요 기능

- **하단 위젯**: AI 에이전트들이 항상 표시
- **1:1 채팅**: 개별 AI와 전문 상담
- **회의실**: 여러 AI가 토론하며 아이디어 고도화
- **멀티 프로바이더**: Claude, GPT, Gemini, Ollama 동시 사용
- **커스터마이징**: 에이전트 추가/편집, 페르소나 설정

## 기술 스택

- Electron 34+
- Anthropic Claude API / OpenAI API / Google Gemini API
- electron-store (설정 저장)
- electron-builder (macOS 빌드)
