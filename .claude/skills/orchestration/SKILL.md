---
name: orchestration
description: AI 오케스트레이션 패턴. 다중 AI 조합, 턴 관리, context 빌딩 방법.
---

# AI Orchestration Patterns

## Adapter Pattern for Multi-Provider
```javascript
// 각 provider를 통일된 인터페이스로
const response = await apiClient.send({
  provider: agent.provider,  // 'claude' | 'openai' | 'gemini' | 'ollama'
  model: agent.model,
  messages: buildContext(agent, history),
  stream: true
});

for await (const chunk of response) {
  yield chunk; // UI로 스트리밍 전달
}
```

## Context Building
```javascript
function buildContext(agent, meetingHistory) {
  return [
    { role: 'system', content: agent.systemPrompt },
    { role: 'system', content: `회의 규칙: ${meetingRules}` },
    ...meetingHistory.slice(-10).map(h => ({
      role: h.agentId === agent.id ? 'assistant' : 'user',
      content: `[${h.agentName}] ${h.content}`
    })),
    { role: 'user', content: currentTopic }
  ];
}
```

## Turn Management
- 키워드 기반: 주제에서 키워드 추출 → 에이전트별 키워드 매칭 점수
- 라운드 로빈: 순서대로 돌아가며 발언
- 지명: 사용자가 특정 AI를 지정하여 발언 요청
- 자유: 이전 발언의 @멘션 기반
