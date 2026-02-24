# Phase 1 공유 인터페이스 스펙
> 영자(Gemini)와 Codex가 이 문서를 기준으로 동시에 작업한다.
> 코다리 부장이 정의한 계약이므로 양측 모두 이 스펙을 준수할 것.

---

## 1. 목표
위젯 하단바에서 캐릭터 클릭 → 1:1 채팅 대시보드 창 열기 → 해당 AI API와 실시간 스트리밍 채팅

---

## 2. 데이터 구조 (공통 계약)

### Agent 객체
```json
{
  "id": "agent-1",
  "name": "제갈량 (오케스트레이터)",
  "emoji": "🪭",
  "provider": "google",
  "model": "gemini-2.0-flash",
  "persona": "당신은...",
  "expertise": "시스템 아키텍처, 작업 배분"
}
```

### Message 객체
```json
{
  "id": "msg-{timestamp}",
  "role": "user" | "assistant",
  "content": "메시지 내용",
  "timestamp": 1700000000000,
  "agentId": "agent-1"
}
```

---

## 3. IPC 채널 목록 (공통 계약)

| 채널명 | 방향 | 설명 |
|--------|------|------|
| `open-dashboard` | renderer → main | agentId 전달, 대시보드 창 열기 |
| `get-agent` | renderer ↔ main | agentId로 단일 에이전트 정보 조회 |
| `get-chat-history` | renderer ↔ main | agentId의 대화 기록 조회 |
| `send-message` | renderer → main | { agentId, content } 전달 |
| `stream-chunk` | main → renderer | { chunk: string } 스트리밍 청크 |
| `stream-end` | main → renderer | 스트리밍 완료 신호 |
| `stream-error` | main → renderer | { message: string } 에러 전달 |
| `clear-history` | renderer → main | agentId의 대화 기록 초기화 |

---

## 4. 파일 구조 (Phase 1 완료 기준)

```
renderer/
├── widget.html              # 수정: 클릭 이벤트 연결
├── dashboard.html           # 신규: 채팅 UI (영자 디자인 기준)
├── styles/
│   ├── widget.css           # 기존 유지
│   └── dashboard.css        # 신규: 영자가 정의한 디자인 토큰 기반
└── js/
    └── dashboard.js         # 신규: 채팅 로직 (IPC 연동)

main/
├── api-manager.js           # 신규: Claude/OpenAI/Gemini 어댑터 + 스트리밍
└── agent-store.js           # 신규: 대화 기록 저장/로드

main.js                      # 수정: open-dashboard 핸들러, send-message 핸들러
preload.js                   # 수정: 채팅 관련 IPC 추가
```

---

## 5. 대시보드 창 스펙 (영자용 디자인 가이드)

- 창 크기: 480 × 700px (기본값), 리사이즈 가능
- 테마: 삼국지 전장 장막 느낌 (다크톤, 금/붉은 포인트)
- 상단: 에이전트 이름 + 이모지 + 소개
- 중간: 채팅 메시지 목록 (스크롤)
- 하단: 텍스트 입력창 + 전송 버튼
- 사용자 메시지: 오른쪽 정렬, 파란 버블
- AI 메시지: 왼쪽 정렬, 어두운 버블 + 스트리밍 타이핑 효과
- 우상단: 대화 초기화 버튼

---

## 6. API Provider별 모델 (Codex용)

| Provider | 모델 | 스트리밍 방식 |
|----------|------|-------------|
| anthropic | claude-3-7-sonnet-20250219 | SSE (stream: true) |
| openai | gpt-4o / gpt-4o-mini | SSE (stream: true) |
| google | gemini-2.0-flash | streamGenerateContent |
| ollama | llama-3 | /api/chat (stream) |

---

## 7. 완료 기준 (Definition of Done)

- [ ] 위젯에서 캐릭터 클릭 → 대시보드 창 열림
- [ ] 에이전트 정보(이름, 이모지, 소개) 헤더 표시
- [ ] 이전 대화 기록 로드되어 표시
- [ ] 메시지 입력 → 전송 → AI 스트리밍 응답 표시
- [ ] 대화 기록 electron-store에 저장
- [ ] 오류 시 사용자에게 토스트 알림
- [ ] API 키 미설정 시 안내 메시지 표시
