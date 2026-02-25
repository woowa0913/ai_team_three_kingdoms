# 영자 작업 전달서 — Sprint 3 회의실 UX 폴리싱

## 번개 구현 완료 범위
- 회의실 사용자 참여 플로우 구현 완료
  - 일시정지 → 사용자 메시지 입력 → 재개
- 회의실 JS 분할 완료
  - `renderer/js/meeting.js`: 상태/이벤트/초기화 (276줄)
  - `renderer/js/meeting-speech.js`: 발언 렌더링/스트리밍 DOM (187줄)
- 상태 머신 확장 완료 (`main/meeting-engine.js`)
  - `pauseRequested`, `requestPause()`, `resumeMeeting()`, `appendUserSpeech()`, `getAiTurnCount()`
  - 사용자 발언이 AI 턴 계산에 영향을 주지 않도록 처리
- IPC/Preload 연동 완료
  - `pause-meeting`, `resume-meeting`, `send-meeting-message`, `meeting-paused`
- 테스트 확장 완료
  - `tests/meeting-engine.test.js` 7개 테스트 통과

## 영자 작업 요청 (CSS 중심)
대상 파일: `renderer/styles/meeting.css`

### 1) 일시정지/입력 패널 시각 완성도 업그레이드
핵심 셀렉터:
- `.btn-pause-meeting`
- `.user-input-panel`
- `.user-message-input`
- `.user-input-actions`
- `.btn-send-user-message`
- `.btn-resume-meeting`

요구사항:
- 사이드바 버튼 체계와 자연스럽게 어울리게 통일
- 입력 패널을 "회의가 멈춘 상태"로 인지되게 강조
- 다크/라이트에서 대비 안정성 확인

### 2) 사용자 발언과 AI 발언의 시각 구분 강화
핵심 셀렉터:
- `.speech-item.user`
- `.speech-item.user .speech-meta`
- `.speech-item.user .speech-bubble`
- `.speech-item.streaming`

요구사항:
- 사용자 발언이 로그에서 즉시 식별되도록 대비 개선
- AI 발언/사용자 발언의 역할 구분이 명확해야 함

### 3) 토론 횟수 라벨/툴팁 폴리싱
핵심 셀렉터:
- `.round-label`
- `.round-tooltip`

요구사항:
- 툴팁 아이콘 크기/정렬/hover 피드백 정리
- 삼국지 치비 테마 톤 유지

### 4) 상태 배지 상태값 시각 체계 정리
핵심 셀렉터:
- `.meeting-status-badge`
- `.meeting-status-badge.active`
- `.meeting-status-badge.paused`

요구사항:
- `대기 / 진행중 / 일시정지` 3상태가 직관적으로 구분되게

## 구현 참고 위치
- 회의실 마크업: `renderer/meeting.html`
  - 토론 횟수 라벨/툴팁
  - 일시정지 버튼
  - 사용자 입력 패널
- 발언 렌더링 로직: `renderer/js/meeting-speech.js`
- 회의 상태/이벤트 로직: `renderer/js/meeting.js`

## 번개 검증 결과
- `npm test` 통과: 14 tests passed
- `npm start` 부팅 확인 완료
- GUI 상호작용은 영자 CSS 반영 후 최종 시각 QA 필요
