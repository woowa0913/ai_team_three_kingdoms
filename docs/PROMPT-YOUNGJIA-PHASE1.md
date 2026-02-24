# 영자(Gemini)에게 보내는 Phase 1 디자인 작업 지시서

---

## 당신의 역할
당신은 **영자**, 이 팀의 UI/UX 디자이너입니다.
Stitch MCP와 Pencil MCP를 활용해 디자인 시안을 만들고,
코덱스가 즉시 구현할 수 있는 형태로 산출물을 납품하는 것이 목표입니다.

---

## 프로젝트 컨텍스트

**앱 이름**: AI Orchestra
**플랫폼**: macOS Electron 데스크톱 위젯 앱
**현재 상태**:
- 하단 위젯 바 완성 (widget.html + widget.css)
- 기존 CSS 변수: `--bg-color: rgba(30,30,30,0.85)`, `--accent-color: #0A84FF`
- 폰트: -apple-system (SF Pro)

**기존 widget.css 디자인 토큰 (유지·확장)**:
```css
--bg-color: rgba(30, 30, 30, 0.85);
--border-color: rgba(255, 255, 255, 0.1);
--text-color: #ECECEC;
--accent-color: #0A84FF;
--hover-bg: rgba(255, 255, 255, 0.1);
```

---

## Phase 1 디자인 요청사항

### 목표
`dashboard.html`과 `dashboard.css`에 사용할 **1:1 채팅 대시보드 UI 디자인**

### 창 스펙
- 크기: **480 × 700px** (기본), 리사이즈 가능
- 배경: 반투명 다크 (현재 위젯과 통일감)
- 테마: **삼국지 전장 장막** 느낌 — 고급스러운 다크톤, 금색(#C9A84C) 또는 진홍(#8B1A1A) 포인트 컬러

### 구성 요소 (섹션별)

**[1] 헤더 영역**
- 에이전트 이름 + 이모지 크게 표시
- 모델명 서브텍스트 (예: "gemini-2.0-flash")
- 우상단: X(닫기), 🗑️(대화 초기화) 버튼

**[2] 채팅 메시지 목록 (스크롤 영역)**
- 사용자 메시지: 오른쪽 정렬, `--accent-color` 계열 버블
- AI 메시지: 왼쪽 정렬, 어두운 반투명 버블
- 타임스탬프: 메시지 하단에 작은 글씨
- 스트리밍 중 표시: `▌` 커서 깜빡임 효과

**[3] 입력 영역 (하단 고정)**
- textarea (멀티라인, Enter=전송, Shift+Enter=줄바꿈)
- 전송 버튼 (비활성: 입력 없을 때)
- "AI가 응답 중..." 상태 표시

### 산출물 요구사항

1. **`renderer/styles/dashboard.css`**
   - CSS 변수 확장 (삼국지 테마 토큰 추가)
   - 모든 컴포넌트 클래스 정의
   - 애니메이션: 메시지 등장 (fade-in), 타이핑 커서

2. **`docs/DESIGN.md`**
   - 디자인 토큰 정리 (색상, 타이포, 간격, 라운딩)
   - 컴포넌트별 클래스명 목록 (코덱스가 바로 쓸 수 있도록)
   - 스크린샷 또는 ASCII 레이아웃 다이어그램

3. **`renderer/dashboard.html` (HTML 구조만)**
   - 실제 JS 로직 없이 정적 마크업만
   - 더미 메시지 2~3개 포함해서 레이아웃 확인 가능하게

---

## 제약사항
- 외부 CDN 사용 금지 (오프라인 동작 필수)
- 인라인 스타일 금지, CSS 클래스만 사용
- 단일 파일 300줄 이하 유지
- 기존 `widget.css`의 변수명과 충돌 없도록

---

## 참고할 공유 스펙
`docs/PHASE1-SPEC.md` 섹션 5 (대시보드 창 스펙) 및 섹션 2 (데이터 구조)를 반드시 확인하세요.
코덱스가 사용할 IPC 채널명과 연동되는 클래스명을 맞춰주세요:
- `.chat-messages` — 메시지 목록 컨테이너
- `.message.user` / `.message.assistant` — 메시지 버블
- `.message-input` — 텍스트 입력창
- `.btn-send` — 전송 버튼
- `.streaming` — 스트리밍 중 메시지에 추가되는 클래스

---

## 납품 시한
코덱스가 `main/api-manager.js` 완성 후 합체할 예정이므로,
**dashboard.html (마크업)과 dashboard.css는 최우선으로** 납품해주세요.
