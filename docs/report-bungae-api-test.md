# ⚡ 번개 보고 — Sprint A API 연결 테스트

보고 일시: 2026-02-25  
담당: 번개(Codex)

## 1) 실행 환경/전제

- `npm start` 앱 기동 확인: **성공** (`[BOOT] app ready 진입`)
- 현재 검증 환경의 store 키 상태:
  - `anthropic`: 미설정
  - `openai`: 미설정
  - `google`: 미설정
- 외부 API 네트워크는 제한 상태로 동작(실제 원격 API 호출 시 `fetch failed` 발생)

## 2) Task 1 — 1:1 채팅(5명) 테스트 결과

GUI 수동 클릭 기반 전체 시나리오는 본 환경 제약(키 미설정 + 외부 네트워크 제한)으로 **완전 재현 불가**.  
대신 `apiManager.streamChat` 실제 경로로 provider별 스모크 실행.

1. 제갈량 (Google / gemini-2.0-flash): **PASS (에러 처리 확인)**
- 키 미설정 시: `google API 키가 설정되지 않았습니다.`

2. 주유 (Anthropic / claude-3-7-sonnet): **PASS (에러 처리 확인)**
- 키 미설정 시: `anthropic API 키가 설정되지 않았습니다.`

3. 관우 (OpenAI / gpt-4o): **PASS (에러 처리 확인)**
- 키 미설정 시: `openai API 키가 설정되지 않았습니다.`

4. 장비 (OpenAI / gpt-4o-mini): **PASS (에러 처리 확인)**
- 키 미설정 시: `openai API 키가 설정되지 않았습니다.`

5. 사마의 (Ollama / llama-3): **PASS (요구사항 충족)**
- 로컬 서버 미실행 시: `Ollama가 실행 중이지 않습니다. localhost:11434 서버를 확인해주세요.`

## 3) Task 2 — 에러 처리 테스트 결과

1. API 키 미설정 상태 채팅
- 결과: **PASS**
- 스트리밍 레이어 에러 메시지 생성 확인(위 provider별 메시지)
- 렌더러 말풍선 경로:
  - `renderer/js/dashboard-chat.js`의 `handleStreamError()`에서 `error-content`로 표시 후 finalize

2. 잘못된 키 입력
- 결과: **부분 확인**
- override로 잘못된 키 주입 시 본 환경에서는 원격 응답 대신 네트워크 차단으로 `fetch failed` 반환
- 즉, "잘못된 키(401/403) 상세 메시지"는 네트워크 가능한 환경에서 재확인 필요

3. 캐릭터별 API 키 오버라이드
- 결과: **PASS (코드 경로 확인 + 기존 테스트 통과)**
- `streamChat(..., apiKeyOverride)` 전달 및 provider 수신 확인
- 관련 테스트: `tests/api-manager-override.test.js` 통과

## 4) Task 3 — 회의실 테스트 결과

GUI 수동 플로우(본진 클릭 → 참석자 선택 → 시작 → 일시정지/사용자 입력/재개)는  
본 세션에서 화면 자동조작 불가로 **수동 재현 보류**.

대신 기능 핵심 로직은 테스트로 확인:

1. 회의 상태 머신
- `requestPause()`, `resumeMeeting()`, `appendUserSpeech()`, `getAiTurnCount()` 테스트 **PASS**
- 파일: `tests/meeting-engine.test.js` (7 tests)

2. 전체 자동 테스트
- `npm test` 결과: **5 files / 15 tests 전부 PASS**

## 5) 병렬 확인(영자 Task 연계)

1. 본진(fortress.png) 위젯 적용 여부: **미적용**
- 현재 코드: `renderer/js/widget.js`에서 본진이 `🏯` 이모지 하드코딩
- 근거: `buildTentItem()` 내부 `emoji.textContent = '🏯';`
- 조치 필요: `fortress.png` 이미지 노드 렌더링으로 교체

## 6) 버그 리포트 요약

1. [중요도: 중] 본진 이미지 미적용
- 증상: 위젯 본진이 `fortress.png`가 아니라 이모지 `🏯`로 표시
- 위치: `renderer/js/widget.js`
- 권장 수정:
  - `span.emoji` 대신 `img.agent-img` 사용
  - `src = 'assets/fortress.png'`, `alt = '본진'`

2. [중요도: 중] 네트워크 차단 환경에서 API 테스트 에러 메시지가 `fetch failed`로 단순 노출
- 증상: 잘못된 키 여부와 네트워크 단절이 UI에서 구분 어려움
- 위치: `main/api-providers/{openai,anthropic,google}.js` fetch 에러 처리
- 권장 수정:
  - `TypeError: fetch failed`를 provider별 "네트워크 연결 실패" 메시지로 래핑

## 7) 결론

- 치명적(앱 크래시/데이터 유실) 버그는 본 테스트 범위에서 **미발견**
- 자동 테스트는 전부 통과
- 실제 API 스트리밍 성공(정상 응답 chunk 수신)은
  1) 유효 키 입력
  2) 외부 네트워크 허용
  3) Ollama 로컬 서버 실행
  조건에서 대표님 환경에서 최종 수동 확인 필요
