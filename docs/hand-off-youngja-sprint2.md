# 영자 작업 전달서 — Sprint 2 후속 디자인

## 번개 구현 완료 범위
- P2b API 에러를 채팅 말풍선으로 표시
  - 빈 스트리밍 assistant 말풍선에 `⚠️ 에러메시지`를 채움
  - `.error-content` 클래스 부여
  - 기존 `handleStreamError()`의 toast 호출 제거
- P2c 대시보드 투명도 슬라이더 추가
  - 헤더에 `#opacity-slider` 추가 (20~100)
  - `set-window-opacity` IPC 연결 (`0.2 ~ 1.0` clamp)
- P3 다크모드 설정 이동
  - settings 상단에 시스템/다크/라이트 3버튼 섹션 추가
  - 클릭 시 `setTheme()` 호출 + active 하이라이트 반영
- 파일 분할/정리
  - `renderer/js/dashboard.js`: 215줄
  - `renderer/js/dashboard-chat.js`: 282줄
  - `renderer/js/dashboard-persona.js`: 300줄
  - `renderer/styles/widget.css`: 300줄

## 영자 작업 요청 (디자인 폴리싱)

### Task 1. 대시보드 에러 말풍선 + 투명도 슬라이더 스타일 다듬기
대상 파일: `renderer/styles/dashboard.css`

핵심 셀렉터:
- `.error-content`
- `.opacity-control`
- `.opacity-icon`
- `#opacity-slider`

요청사항:
- 에러 말풍선이 경고지만 과하지 않게 보이도록 톤 조정
- 슬라이더를 헤더 액션 영역에 더 자연스럽게 통합
- 다크/라이트 양쪽 대비 확인

### Task 2. 설정 화면 테마 섹션 스타일 고도화
대상 파일: `renderer/styles/settings.css`

핵심 셀렉터:
- `.theme-section`
- `.theme-title`
- `.theme-options`
- `.theme-btn`
- `.theme-btn.active`

요청사항:
- 삼국지 치비 테마와 일관된 질감/색감
- 활성 버튼(현재 테마) 하이라이트 강화
- API 키 카드 스타일과 통일감 유지

## 참고 마크업/스크립트 위치
- 대시보드 슬라이더 마크업: `renderer/dashboard.html`
- 에러 말풍선 로직: `renderer/js/dashboard-chat.js` (`handleStreamError`)
- 설정 테마 버튼 마크업: `renderer/settings.html`
- 설정 테마 동작 로직: `renderer/js/settings.js` (`bindThemeSelector`)

## 번개 검증 결과
- `npm test` 통과 (4 files, 10 tests)
- `npm start` 부팅 확인
- GUI 시각 품질(디자인 완성도)은 영자 폴리싱 후 최종 재확인 필요
