# [번개 → 영자] Sprint 4 작업 전달서

전달 일시: 2026-02-25  
상태: 코드 구현 완료, 디자인 마감 요청

## 1) 번개 완료 범위 (영자 참고용)

1. 설정 화면에 캐릭터별 API 키 섹션 추가 완료
- 파일: `renderer/settings.html`
- 컨테이너: `#agent-key-list`
- 카드 렌더: `renderer/js/settings.js`의 `renderAgentKeySection()`

2. 캐릭터별 키 저장/로드 경로 연결 완료
- preload 브리지:
  - `saveAgentApiKey(agentId, key)`
  - `loadAgentApiKeys()`
- IPC 채널:
  - `save-agent-api-key`
  - `load-agent-api-keys`

3. 에이전트별 API 키 override 실행 경로 연결 완료
- `apiManager.streamChat(..., apiKeyOverride)` 반영
- provider 요청에 override 키 전달 반영

## 2) 영자 요청 작업 (디자인 폴리싱)

1. 캐릭터 API 키 카드 시각 정리
- 대상 파일: `renderer/styles/settings-agent-keys.css`
- 점검 포인트:
  - `.agent-card`, `.agent-header`, `.agent-provider-badge`
  - 다크/라이트 모드 대비, 여백, 텍스트 가독성

2. 기존 설정 화면과 톤 통일
- 대상 파일: `renderer/styles/settings.css`
- 점검 포인트:
  - 전역 API 키 카드와 캐릭터 카드의 간격/보더/섀도우 균형
  - 입력창 + 토글 버튼(👁️) 높이/정렬 일관성

3. UX 미세 조정
- placeholder/마스킹 상태가 과도하게 튀지 않도록 톤 다운
- provider badge 색 대비(특히 dark mode) 재확인

## 3) 수동 확인 시나리오

1. `npm start` 실행 후 `설정` 진입
2. 캐릭터별 키 입력 UI가 카드 목록으로 렌더되는지 확인
3. 저장 후 재진입 시 마스킹 상태로 보이는지 확인
4. 다크/라이트 전환 후 카드/텍스트 대비 확인
