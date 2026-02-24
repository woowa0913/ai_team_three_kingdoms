# ✨ 영자에게 — Phase 2 설정 화면 디자인 지시서

> 코다리 부장 발령. 번개와 동시에 착수할 것.

---

## 컨텍스트 브리핑

Phase 1 기반 작업이 완성됐습니다! 수고했어요 영자 🎉
이제 앱을 실제로 사용하려면 **API 키 설정 화면**이 없으면 동작 불가예요.
번개가 설정 창 로직(`settings.js`, IPC 핸들러)을 동시에 작업 중이니,
영자는 UI 마크업과 CSS만 납품해주면 됩니다.

---

## 기존 디자인 시스템 (그대로 유지)

`dashboard.css`에 정의된 토큰 재활용:
```css
--bg-overlay: rgba(20, 18, 18, 0.95);
--text-color: #ECECEC;
--text-muted: #8E8E93;
--accent-gold: #C9A84C;
--accent-crimson: #8B1A1A;
--border-color: rgba(255, 255, 255, 0.1);
--border-radius-base: 12px;
```
`settings.css`는 이 변수들을 `@import` 없이 직접 재정의하거나,
`dashboard.css`와 동일한 `:root` 블록을 복사해 사용할 것 (CDN 금지).

---

## 설정 화면 요구사항

### 창 크기
- **480 × 520px**, 리사이즈 불가

### 화면 구성 (섹션별)

**[1] 헤더**
- 타이틀: "⚙️ API 키 설정"
- 서브텍스트: "AI와 대화하려면 각 서비스의 API 키를 입력하세요."

**[2] API 키 입력 폼 (3개)**

각 provider는 동일한 카드 레이아웃으로:
```
┌─────────────────────────────────────┐
│  🟣 Anthropic (Claude)              │
│  [•••••••••••••••••••  ]            │  ← 입력창 (type="password")
│  👁 보이기/숨기기 토글               │
└─────────────────────────────────────┘
```

- **Anthropic (Claude)** — 이모지: 🟣, 라벨색: 보라/파랑
- **OpenAI (GPT)** — 이모지: 🟢, 라벨색: 초록
- **Google (Gemini)** — 이모지: 🔵, 라벨색: 파랑

비밀번호 토글(👁) 클릭 시 `type="password"` ↔ `type="text"` 전환.

**[3] 하단 버튼**
- `저장하기` 버튼 (accent-crimson 배경)
- `취소` 버튼 (투명 배경, 텍스트만)

---

## 필수 클래스명 (번개 settings.js와 연동)

번개가 이 클래스명을 기준으로 JS를 작성 중이므로 반드시 준수:

| 요소 | 클래스 / 속성 |
|------|-------------|
| provider 카드 래퍼 | `data-provider="anthropic"` / `"openai"` / `"google"` |
| API 키 입력창 | `<input class="api-key-input" type="password">` |
| 눈 토글 버튼 | `<button class="btn-toggle-visibility">` |
| 저장 버튼 | `<button class="btn-save">` |
| 취소 버튼 | `<button class="btn-cancel">` |
| JS 연결 | `<script src="js/settings.js"></script>` |

---

## 납품 목록

1. **`renderer/settings.html`** — 정적 마크업 (JS 로직 없이)
2. **`renderer/styles/settings.css`** — 설정 화면 스타일

> settings.html에서 `dashboard.css` 재사용하지 말고 `settings.css`를 별도 링크할 것.

---

## 추가 요청 — widget.html 설정 버튼 디자인

번개가 `widget.html`에 ⚙️ 버튼을 추가할 예정이에요.
아래 CSS를 `widget.css`에 추가해주세요 (기존 `.btn-meeting` 스타일 옆에):

```css
.btn-settings {
    /* btn-meeting과 비슷하되 더 작고 투명한 느낌으로 */
    /* background: transparent, border: none, 호버 시 살짝 밝아지는 효과 */
}
```

---

## 완료 보고 형식

모든 작업 완료 후 **코다리 부장에게** 아래 형식으로 보고할 것:

```
✨ 영자 보고 — Phase 2 설정 화면 디자인

✅ [완료 목록]
  └─ settings.html 마크업 완성
  └─ settings.css 스타일 완성
  └─ widget.css .btn-settings 추가

📌 [번개에게 전달 사항]
  └─ 클래스명 변경 또는 특이사항 있으면 여기 기재

🎨 [디자인 포인트]
  └─ (주요 디자인 결정 사항 간단히)
```
