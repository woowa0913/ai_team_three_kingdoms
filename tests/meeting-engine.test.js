import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('meeting-engine', () => {
    let meetingEngine;

    beforeEach(async () => {
        vi.resetModules();
        const imported = await import('../main/meeting-engine.js');
        meetingEngine = imported.default || imported;
    });

    it('starts with unique participants and enters STARTED state', () => {
        const state = meetingEngine.startMeeting('테스트 주제', ['agent-1', 'agent-2', 'agent-1'], 2);
        expect(state.status).toBe('STARTED');
        expect(state.topic).toBe('테스트 주제');
        expect(state.participants).toEqual(['agent-1', 'agent-2']);
        expect(state.maxRounds).toBe(2);
    });

    it('returns turns in participant order across rounds', () => {
        meetingEngine.startMeeting('턴 순서', ['agent-1', 'agent-2'], 2);

        const first = meetingEngine.getNextTurnContext();
        expect(first.agentId).toBe('agent-1');
        expect(first.round).toBe(1);
        meetingEngine.appendSpeech({ id: 'agent-1', name: 'A1' }, '첫 발언');

        const second = meetingEngine.getNextTurnContext();
        expect(second.agentId).toBe('agent-2');
        expect(second.round).toBe(1);
        meetingEngine.appendSpeech({ id: 'agent-2', name: 'A2' }, '둘째 발언');

        const third = meetingEngine.getNextTurnContext();
        expect(third.agentId).toBe('agent-1');
        expect(third.round).toBe(2);
    });

    it('stops meeting and marks state as ENDED', () => {
        meetingEngine.startMeeting('중단 테스트', ['agent-1', 'agent-2'], 1);
        const stopped = meetingEngine.stopMeeting();
        expect(stopped.status).toBe('ENDED');
        expect(meetingEngine.getNextTurnContext()).toBeNull();
    });

    it('pauses meeting when requested', () => {
        meetingEngine.startMeeting('일시정지 테스트', ['agent-1', 'agent-2'], 1);
        meetingEngine.requestPause();
        const turn = meetingEngine.getNextTurnContext();
        const state = meetingEngine.getState();

        expect(turn).toBeNull();
        expect(state.status).toBe('PAUSED');
    });

    it('appends user speech with user metadata', () => {
        meetingEngine.startMeeting('사용자 발언 테스트', ['agent-1', 'agent-2'], 1);
        const speech = meetingEngine.appendUserSpeech('제가 한 말씀 드리겠습니다.');

        expect(speech.agentId).toBe('user');
        expect(speech.agentName).toBe('사용자');

        const state = meetingEngine.getState();
        expect(state.history.at(-1).agentId).toBe('user');
    });

    it('counts only AI turns', () => {
        meetingEngine.startMeeting('AI 턴 카운트', ['agent-1', 'agent-2'], 2);

        meetingEngine.getNextTurnContext();
        meetingEngine.appendSpeech({ id: 'agent-1', name: 'A1' }, 'AI 발언 1');
        meetingEngine.appendUserSpeech('사용자 의견');
        meetingEngine.getNextTurnContext();
        meetingEngine.appendSpeech({ id: 'agent-2', name: 'A2' }, 'AI 발언 2');

        expect(meetingEngine.getAiTurnCount()).toBe(2);
    });

    it('resumes meeting from paused state', () => {
        meetingEngine.startMeeting('재개 테스트', ['agent-1', 'agent-2'], 1);
        meetingEngine.requestPause();
        meetingEngine.getNextTurnContext();

        const resumed = meetingEngine.resumeMeeting();
        expect(resumed.status).toBe('WAITING');
    });
});
