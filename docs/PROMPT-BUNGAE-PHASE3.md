# ⚡ 번개에게 — Phase 3: 실행 가능한 앱 완성

> 코다리 부장 지시. 코드는 다 있다. 근데 지금 `npm start` 하면 앱이 안 켜진다.
> 6가지 수정 끝내고 `npm start` 정상 실행 확인까지가 이번 목표.

---

## 🚨 수정 1 (최긴급): electron-store v8 → v7 다운그레이드

**현상**: `npm start` 실행 시 앱 자체가 크래시.

**원인**: `electron-store@8`은 ESM-only. `main.js`와 `main/api-manager.js`가 `require('electron-store')` CJS 방식으로 불러오고 있어서 아래 에러 발생:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module
```

**수정**: 터미널에서 아래 명령 실행.
```bash
npm uninstall electron-store
npm install electron-store@7
```

`require('electron-store')` 코드는 그대로 유지해도 됨 (v7은 CJS 지원).

---

## 🚨 수정 2 (긴급): widget.html — 회의실 버튼 비활성화 + 이벤트 누락

**현상**: 위젯에서 👥 회의실 버튼을 눌러도 아무 반응 없음.

**원인 1**: `renderer/widget.html` 18번줄에 `disabled` 속성이 달려 있음.
```html
<!-- 현재 (잘못됨) -->
<button id="btn-meeting" class="icon-button btn-meeting" title="会議室/Meeting" disabled>👥</button>
```

**원인 2**: `btn-settings`는 이벤트 리스너가 있는데 `btn-meeting`은 없음. 88번줄 설정 버튼 리스너 아래에 회의실 리스너가 빠져 있음.

**수정**: `renderer/widget.html`

1. `disabled` 속성 제거:
```html
<button id="btn-meeting" class="icon-button btn-meeting" title="작전 회의실">👥</button>
```

2. `btn-settings` 이벤트 리스너 바로 아래에 추가:
```javascript
document.getElementById('btn-meeting').addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.openMeetingRoom) {
        window.electronAPI.openMeetingRoom();
    }
});
```

---

## 🚨 수정 3 (긴급): default-agents.json — 존재하지 않는 모델명

**현상**: 제갈량(agent-1)과 대화 시도 시 API 에러 발생.

**원인**: `config/default-agents.json` 3번줄 `"model": "gemini-3.1-pro"` → 이 모델은 존재하지 않음.

**수정**: `config/default-agents.json`에서 agent-1의 model 값 교체:
```json
// 변경 전
"model": "gemini-3.1-pro"

// 변경 후
"model": "gemini-2.0-flash"
```

---

## ⚠️ 수정 4: widget.css — 상태 뱃지 초기 색상 불일치

**현상**: 에이전트 아이콘 하단 뱃지가 항상 초록색 배경인데, 초기 텍스트는 `⚫ 대기 중`.
처음 뜰 때는 회색/어두운 배경이어야 맞음.

**수정**: `renderer/styles/widget.css`

`.status-badge` 기본 스타일을 회색으로 변경하고, 활성 상태용 클래스 추가:

```css
/* 기존 코드에서 background-color 값만 변경 */
.status-badge {
    position: absolute;
    bottom: -6px;
    background-color: rgba(60, 60, 70, 0.9);  /* 기본: 회색 */
    color: #b0b0b0;                            /* 기본: 회색 텍스트 */
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    border: 2px solid rgba(20, 20, 25, 0.8);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
}

/* 업무 중 상태 */
.status-badge.active {
    background-color: var(--status-active);
    color: #fff;
}
```

`renderer/widget.html`에서 클릭 시 뱃지 텍스트 바꾸는 부분도 클래스 추가로 수정:
```javascript
// 기존
badgeSpan.textContent = '🟢 업무 중';

// 수정
badgeSpan.textContent = '🟢 업무 중';
badgeSpan.classList.add('active');
```

---

## ⚠️ 수정 5: main.js — widget 창 위치 자동 계산

**현상**: `y: 900` 하드코딩. 화면 해상도에 따라 창이 화면 밖으로 이탈 가능.

**수정**: `main.js`

상단 import 라인 수정 (`screen` 추가):
```javascript
const { app, BrowserWindow, ipcMain, screen } = require('electron');
```

`createWidgetWindow()` 함수 안 `BrowserWindow` 생성 바로 전에 추가:
```javascript
const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
const windowHeight = 100;
const yPosition = screenHeight - windowHeight - 20;
```

`y: 900` → `y: yPosition` 으로 교체.

그리고 `BrowserWindow` 생성 옵션에 `show: false` 추가 후 `loadFile` 아래에:
```javascript
widgetWindow.once('ready-to-show', () => {
    widgetWindow.show();
});
```

---

## 📦 수정 6: 빌드 준비 — generate-icon.py + package.json

**레퍼런스(AI Office 앱)는 Python 스크립트로 아이콘을 자동 생성함. 동일하게 구현.**

### 6-1. `build/` 폴더 생성
```bash
mkdir -p build
```

### 6-2. `generate-icon.py` 생성

프로젝트 루트에 아래 파일 생성:

```python
#!/usr/bin/env python3
"""
AI Orchestra 앱 아이콘 생성 스크립트
사전 요구사항: pip install Pillow
실행: python3 generate-icon.py
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 배경: 다크 + 골드 테두리 느낌의 원형 아이콘
    radius = int(size * 0.22)
    bg_color = (20, 18, 18, 240)
    border_color = (201, 168, 76, 255)

    # 둥근 사각형 배경
    draw.rounded_rectangle(
        [4, 4, size - 4, size - 4],
        radius=radius,
        fill=bg_color,
        outline=border_color,
        width=max(2, size // 64)
    )

    # 중앙 텍스트 (이모지 대체 — 단순 심볼)
    symbol = "⚔"
    font_size = int(size * 0.45)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Apple Color Emoji.ttc", font_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), symbol, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = (size - text_h) // 2
    draw.text((x, y), symbol, font=font, fill=(201, 168, 76, 255))

    return img

def main():
    os.makedirs('build/icon.iconset', exist_ok=True)

    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        img = create_icon(s)
        img.save(f'build/icon.iconset/icon_{s}x{s}.png')
        if s <= 512:
            img2x = create_icon(s * 2)
            img2x.save(f'build/icon.iconset/icon_{s}x{s}@2x.png')

    # 1024x1024 원본도 저장
    create_icon(1024).save('build/icon.png')

    print("✅ 아이콘 생성 완료: build/icon.iconset/")
    print("📦 .icns 변환 명령: iconutil -c icns build/icon.iconset -o build/icon.icns")
    print("   완료 후 npm run build 실행")

if __name__ == '__main__':
    main()
```

### 6-3. `package.json` build 섹션 수정

`build.mac` 섹션에 아이콘 경로 + files 추가:
```json
"build": {
    "appId": "com.solopreneur.aiorchestra",
    "mac": {
        "category": "public.app-category.productivity",
        "target": "dmg",
        "icon": "build/icon.icns"
    },
    "files": [
        "**/*",
        "!node_modules/.cache",
        "!docs",
        "!.claude"
    ]
}
```

---

## ✅ 검증 체크리스트

수정 후 순서대로 확인하고 결과 보고:

1. `npm install` 재실행
2. `npm start` — 앱 정상 실행 여부
3. widget 창 위치 — 화면 하단에 제대로 위치하는지
4. 에이전트 아이콘 클릭 → 대시보드 창 열리는지
5. ⚙️ 버튼 → 설정 창 열리는지
6. 👥 버튼 → 회의실 창 열리는지 (이번에 고친 항목)
7. 에이전트 클릭 후 뱃지 색상 → 초록으로 변하는지

---

## 완료 보고 형식

```
⚡ 번개 보고 — Phase 3 실행 환경 완성

✅ [완료]
  └─ electron-store v7 다운그레이드
  └─ widget 회의실 버튼 활성화 + 이벤트 연결
  └─ default-agents.json 모델명 수정 (gemini-2.0-flash)
  └─ status-badge 초기 색상 수정
  └─ widget 창 위치 자동계산 + 플래시 방지
  └─ generate-icon.py 생성 + package.json 빌드 설정

🧪 [검증 결과]
  └─ npm start: (성공/실패 + 에러 메시지)
  └─ 창 열기 (대시보드/설정/회의실): (성공/실패)

🛑 [블로커]
  └─ (있으면 기재)
```
