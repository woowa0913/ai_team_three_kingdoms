# ✨ 영자에게 — Phase 3: 레퍼런스 기준 UI 완성

> 코다리 부장 지시.
> 레퍼런스 앱(AI Office) 스크린샷처럼 사용자가 처음 켰을 때
> "오, 이거 진짜 앱이다" 느낌 나도록 UI 완성.
> 번개가 실행 환경 고치는 동안 영자는 이 3가지 작업 병렬 진행.

---

## 📸 레퍼런스 스크린샷 핵심 포인트

- macOS 데스크톱 하단에 위젯이 투명하게 떠있음
- 에이전트 아이콘: 둥근 사각형 + 이모지 + 하단 이름/역할 텍스트
- 클릭 시 오른쪽에 다크 패널이 뜸 (탭: 채팅 / 페르소나 / 능력/스킬)
- 우리 widget.css는 이미 이 스타일로 잘 잡혀 있음. 빠진 부분만 채우면 됨.

---

## 🎨 작업 1 (최우선): dashboard.html — 탭 UI 추가

**현재 문제**: 레퍼런스는 채팅 패널에 "채팅 / 페르소나 / 능력/스킬" 탭이 있음. 우리 dashboard.html에 없음.

### dashboard.html 수정

헤더(`<header>`) 바로 아래, 기존 채팅 영역 위에 탭바 + 콘텐츠 영역 추가.
기존 `.chat-messages`와 입력창은 `<div class="tab-content" id="tab-chat">` 안으로 감쌀 것:

```html
<!-- 탭 바 -->
<nav class="tab-bar">
    <button class="tab-btn active" data-tab="chat">💬 채팅</button>
    <button class="tab-btn" data-tab="persona">🎭 페르소나</button>
    <button class="tab-btn" data-tab="skills">⚡ 능력/스킬</button>
</nav>

<!-- 채팅 탭 (기존 .chat-messages + 입력창을 이 div 안에 감쌈) -->
<div class="tab-content active" id="tab-chat">
    <!-- 기존 채팅 영역 그대로 이동 -->
</div>

<!-- 페르소나 탭 -->
<div class="tab-content" id="tab-persona">
    <div class="persona-view">
        <div class="persona-name" id="persona-name"></div>
        <div class="persona-desc" id="persona-desc"></div>
    </div>
</div>

<!-- 능력/스킬 탭 -->
<div class="tab-content" id="tab-skills">
    <div class="skills-view">
        <div class="skill-tag" id="expertise-text"></div>
    </div>
</div>
```

### dashboard.css 추가

```css
.tab-bar {
    display: flex;
    gap: 4px;
    padding: 12px 20px 0;
    border-bottom: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
}

.tab-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: all 0.15s;
}

.tab-btn:hover {
    color: var(--text-color);
    background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
    color: var(--accent-gold);
    border-bottom: 2px solid var(--accent-gold);
}

.tab-content {
    display: none;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
}

.tab-content.active {
    display: flex;
}

.persona-view {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
}

.persona-name {
    font-size: 17px;
    font-weight: 600;
    color: var(--accent-gold);
}

.persona-desc {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-muted);
    white-space: pre-wrap;
}

.skills-view {
    padding: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-content: flex-start;
    overflow-y: auto;
}

.skill-tag {
    background: rgba(201, 168, 76, 0.15);
    border: 1px solid rgba(201, 168, 76, 0.3);
    color: var(--accent-gold);
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 20px;
}
```

### dashboard.js 추가

`init()` 안에서 `bindTabs()` 호출 추가:

```javascript
function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const content = document.getElementById(`tab-${btn.dataset.tab}`);
            if (content) content.classList.add('active');
        });
    });
}
```

에이전트 정보 로드 후 페르소나·능력 탭 내용 채우기:
```javascript
const personaName = document.getElementById('persona-name');
const personaDesc = document.getElementById('persona-desc');
const expertiseText = document.getElementById('expertise-text');
if (personaName) personaName.textContent = agent.name || '';
if (personaDesc) personaDesc.textContent = agent.persona || '';
if (expertiseText) expertiseText.textContent = agent.expertise || '';
```

---

## 🎨 작업 2: dashboard.html — API 키 미설정 경고 배너

**현재 문제**: API 키 없으면 메시지 전송 시 에러 토스트만 뜨고 사라짐.

### dashboard.html 추가

`<nav class="tab-bar">` 바로 위(헤더 아래)에 추가:
```html
<div class="api-key-warning" id="api-key-warning" style="display:none">
    ⚠️ API 키가 설정되지 않았습니다.
    <button class="btn-open-settings">설정 열기 →</button>
</div>
```

### dashboard.css 추가

```css
.api-key-warning {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(139, 26, 26, 0.15);
    border-bottom: 1px solid var(--accent-crimson);
    padding: 10px 20px;
    font-size: 13px;
    color: #FF6B6B;
    flex-shrink: 0;
}

.api-key-warning .btn-open-settings {
    background: transparent;
    border: 1px solid var(--accent-crimson);
    color: #FF6B6B;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
}

.api-key-warning .btn-open-settings:hover {
    background: rgba(139, 26, 26, 0.3);
}
```

### dashboard.js 추가

에이전트 로드 후 API 키 상태 확인:
```javascript
const keys = await window.electronAPI.loadApiKeys();
const warning = document.getElementById('api-key-warning');
if (warning && agent) {
    const providerKey = keys[agent.provider] || '';
    const hasKey = providerKey.length > 0 && providerKey !== '****';
    warning.style.display = hasKey ? 'none' : 'flex';
    const btn = warning.querySelector('.btn-open-settings');
    if (btn) btn.addEventListener('click', () => window.electronAPI.openSettings());
}
```

---

## 🎨 작업 3: 전체 UI 레퍼런스 비교 점검

4개 화면을 레퍼런스 스크린샷과 비교하고 차이 있으면 CSS만 수정.

1. **widget.html**: 에이전트 5개 + 버튼 2개가 하단에 자연스럽게 나열되는지. 투명 배경이 작동하는지.
2. **dashboard.html**: 탭 추가 후 레이아웃 깨지는 부분 없는지. 채팅 버블 스타일 정상 여부.
3. **settings.html**: 카드 3개(Anthropic / OpenAI / Google) + 저장 버튼 정렬
4. **meeting.html**: 사이드바 + 발언 로그 2단 레이아웃. 빈 상태 안내 문구 위치.

CSS만 수정. JS 건드리지 말 것.

---

## 완료 보고 형식

```
✨ 영자 보고 — Phase 3 UI 완성

✅ [완료]
  └─ dashboard 탭 UI (채팅/페르소나/능력스킬) 추가
  └─ dashboard API 키 경고 배너
  └─ 전체 UI 레퍼런스 비교 점검 (이상 없음 or 수정 내역)

🛑 [블로커]
  └─ (있으면 기재)
```
