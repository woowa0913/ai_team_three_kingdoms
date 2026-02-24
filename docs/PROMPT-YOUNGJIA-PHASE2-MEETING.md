# ✨ 영자에게 — Phase 2 회의실 디자인 지시서

> 코다리 부장 발령. 번개의 픽스 작업과 동시에 착수할 것.

---

## 수고했어요 영자! 🎉

settings.html 찰떡같이 잘 만들어줬어요.
이제 이 앱의 하이라이트 — **회의실(Meeting Room)** 디자인이에요!
여러 AI가 동시에 토론하는 장면이니까 **삼국지 군사 작전 회의** 분위기로 부탁해요.

---

## 기존 디자인 시스템 (그대로 유지)

```css
--bg-overlay: rgba(20, 18, 18, 0.95);
--text-color: #ECECEC;
--text-muted: #8E8E93;
--accent-gold: #C9A84C;
--accent-crimson: #8B1A1A;
--border-color: rgba(255, 255, 255, 0.1);
--border-radius-base: 12px;
```

---

## 회의실 화면 요구사항

### 창 크기
- **720 × 600px** (기본), 리사이즈 가능 (min: 600 × 480)

### 화면 구성 (3분할 레이아웃)

```
+----------------------------------------------------------+
|  [헤더] ⚔️ 작전 회의실   [회의 중 🔴] / [대기 중 ⚫]  [X] |
+----------------------------------------------------------+
|  [왼쪽 사이드바 200px]   |   [오른쪽 메인 영역]           |
|                          |                                |
|  📋 회의 설정            |  [발언 기록 스크롤 영역]         |
|  주제: [________]        |                                |
|                          |  🪭 제갈량 (1라운드)            |
|  참석자                  |  전략 분석 중이옵니다...▌        |
|  ☑ 🪭 제갈량            |                                |
|  ☑ 🔥 주유              |  🔥 주유 (1라운드)              |
|  ☑ 🐉 관우              |  디자인 방향을 제시하겠습니다.    |
|  ☐ 🐍 장비              |                                |
|  ☐ 🐺 사마의            |                                |
|                          |                                |
|  라운드: [3] 회           |                                |
|                          |                                |
|  [▶ 회의 시작]           |                                |
|  [⏹ 중단]               |                                |
+----------------------------------------------------------+
```

---

## 섹션별 상세 스펙

### [1] 헤더
- 타이틀: "⚔️ 작전 회의실"
- 상태 뱃지: 회의 중 = `🔴 회의 진행 중` / 대기 중 = `⚫ 대기 중`
- X 닫기 버튼 (우상단)

### [2] 왼쪽 사이드바 (설정 패널)

**회의 주제 입력**
- label: "📜 회의 주제"
- `<textarea class="meeting-topic-input">` (3줄, 리사이즈 없음)

**참석자 선택**
- label: "⚔️ 참석자"
- 에이전트 5명 전부 체크박스로 나열 (JS가 동적으로 렌더링)
- 컨테이너: `<div class="participant-list">`
- 각 항목: `<label class="participant-item"><input type="checkbox"> 이모지 이름</label>`
- 최소 2명 선택 필수 (UI 상 validation은 JS 담당)

**라운드 설정**
- label: "🔄 라운드 수"
- `<input type="number" class="round-input" min="1" max="10" value="3">`

**버튼**
- `<button class="btn-start-meeting">▶ 회의 시작</button>` (accent-gold 배경)
- `<button class="btn-stop-meeting" disabled>⏹ 중단</button>` (초기엔 비활성)

### [3] 오른쪽 발언 기록 영역

- 컨테이너: `<div class="speech-log">`
- 빈 상태: "회의를 시작하면 발언이 여기에 표시됩니다." (중앙 안내 텍스트)
- 각 발언 카드: `<article class="speech-item">`
  - 헤더: 이모지 + 이름 + 라운드 뱃지 (`🪭 제갈량 · 1라운드`)
  - 내용: `<div class="speech-content">` (텍스트 들어올 영역)
  - 스트리밍 중: `.speech-item.streaming` → `▌` 커서 효과 (dashboard와 동일)

---

## 필수 클래스명 (번개 meeting.js와 연동)

| 요소 | 클래스명 |
|------|---------|
| 회의 주제 입력 | `.meeting-topic-input` |
| 참석자 목록 컨테이너 | `.participant-list` |
| 참석자 개별 항목 | `.participant-item` (label) |
| 참석자 체크박스 | `input[type="checkbox"]` (data-agent-id 속성 포함) |
| 라운드 수 입력 | `.round-input` |
| 회의 시작 버튼 | `.btn-start-meeting` |
| 회의 중단 버튼 | `.btn-stop-meeting` |
| 발언 기록 컨테이너 | `.speech-log` |
| 개별 발언 카드 | `.speech-item` |
| 발언 내용 | `.speech-content` |
| 스트리밍 상태 | `.speech-item.streaming` |
| 상태 뱃지 | `.meeting-status-badge` |

---

## 납품 목록

1. **`renderer/meeting.html`** — 정적 마크업 (JS 없이, 더미 발언 2~3개 포함)
2. **`renderer/styles/meeting.css`** — 스타일 (설정 패널 + 발언 카드 포함)
3. `<script src="js/meeting.js"></script>` 연결 잊지 말 것

---

## 추가 요청 — widget.html Meeting 버튼 활성화

현재 `widget.html`의 `btn-meeting`이 `disabled` 상태에요.
번개가 `meeting.html` + 창 관리를 완성하면 활성화해야 하므로,
지금은 HTML/CSS만 준비해두면 돼요. (JS 연결은 번개 담당)

---

## 완료 보고 형식

```
✨ 영자 보고 — Phase 2 회의실 디자인

✅ [완료 목록]
  └─ meeting.html 마크업 완성
  └─ meeting.css 스타일 완성

📌 [번개에게 전달 사항]
  └─ 클래스명 변경 등 특이사항

🎨 [디자인 포인트]
  └─ 주요 디자인 결정 사항
```
