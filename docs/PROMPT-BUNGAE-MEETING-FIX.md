# ⚡ 번개에게 — 회의실 버그픽스 3건

> 코다리 부장 QA 발견. 즉시 착수.

---

## 🚨 버그 1 (최긴급): meeting.html — script 태그 주석 처리됨

`renderer/meeting.html` 135번 줄:

```html
<!-- <script src="js/meeting.js"></script> -->
```

→ 주석 해제할 것:

```html
<script src="js/meeting.js"></script>
```

이 버그가 있으면 회의실 JS 로직이 전혀 동작하지 않음.

---

## 🚨 버그 2 (긴급): meeting.html — 더미 발언이 실제 앱에 그대로 노출

`renderer/meeting.html` 103~127번 줄의 더미 `<article class="speech-item">` 3개가
실제 앱 실행 시에도 그대로 보임. meeting.js의 `clearSpeechPlaceholder()`는
`.speech-empty` 클래스를 찾으므로 더미 article은 제거되지 않음.

**수정**: `#speech-log` 안의 더미 article 3개를 모두 삭제하고
`.empty-state` div만 남길 것.

수정 후 `#speech-log`:
```html
<div class="speech-log" id="speech-log">
    <!-- meeting.js가 동적으로 speech-item 삽입 -->
</div>
```

그리고 `meeting.js`의 `init()` 함수에서 시작 시 `.empty-state`를 보이게,
첫 발언 추가 시 숨기는 로직 추가:
```javascript
// clearSpeechPlaceholder 함수 수정
function clearSpeechPlaceholder() {
    const emptyState = find('.empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}
```

---

## ⚠️ 버그 3: meeting.js — .speech-bubble wrapper 누락으로 CSS 스타일 미적용

**현상**: meeting.js가 동적으로 생성하는 발언 카드에 배경색·테두리·패딩이 없음.

**원인**: CSS는 `.speech-bubble` 클래스에 배경/테두리/패딩을 정의했는데,
meeting.js `appendSpeechItem()`에서 `.speech-bubble` wrapper 없이
`.speech-content`를 직접 `.speech-item`에 붙이고 있음.

**CSS 기대 구조**:
```
.speech-item
  └── .speech-meta
  └── .speech-bubble      ← 배경/테두리/패딩
        └── .speech-content
```

**JS 실제 생성 구조**:
```
.speech-item
  └── .speech-meta (div.speech-meta)
  └── .speech-content     ← .speech-bubble 없음!
```

**수정**: `appendSpeechItem()` 함수에서 `.speech-bubble` wrapper 추가:

```javascript
function appendSpeechItem(agentId, agentName, round, initialContent, streaming) {
    const log = find('.speech-log');
    if (!log) return { item: null, content: null };

    clearSpeechPlaceholder();
    const agent = findAgent(agentId);
    const title = `${agent?.emoji || '🤖'} ${agentName || agent?.name || '알 수 없는 화자'} · ${round}라운드`;

    const item = document.createElement('article');
    item.className = 'speech-item';
    if (streaming) item.classList.add('streaming');

    const header = document.createElement('div');
    header.className = 'speech-meta';
    header.textContent = title;

    // ← 추가: speech-bubble wrapper
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';

    const content = document.createElement('div');
    content.className = 'speech-content';
    content.textContent = initialContent || '';

    bubble.appendChild(content);   // content → bubble 안으로
    item.appendChild(header);
    item.appendChild(bubble);      // bubble → item 안으로
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;

    return { item, content };
}
```

---

## 완료 보고 형식

```
⚡ 번개 보고 — 회의실 버그픽스

✅ [완료]
  └─ meeting.html script 태그 주석 해제
  └─ meeting.html 더미 발언 3개 제거
  └─ meeting.js empty-state 숨김 로직 추가
  └─ meeting.js appendSpeechItem .speech-bubble wrapper 추가

🛑 [블로커]
  └─ (있으면 기재)
```
