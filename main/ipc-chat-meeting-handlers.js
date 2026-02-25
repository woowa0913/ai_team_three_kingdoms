const fs = require('fs'); const path = require('path');
function registerChatMeetingHandlers({
    ipcMain,
    app,
    dialog,
    agentStore,
    apiManager,
    meetingEngine,
    createMessage,
    buildChatExportText,
    buildMeetingExportText,
    buildPersonaImprovePrompt,
    ensureAgentId,
    ensureMessageContent,
}) {
    let meetingSessionId = 0;
    let meetingSender = null;
    let isMeetingLoopRunning = false;
    function safeSendToMeeting(channel, payload) {
        if (!meetingSender || meetingSender.isDestroyed()) {
            return;
        }
        meetingSender.send(channel, payload);
    }
    async function runMeetingLoop(sessionId) {
        if (isMeetingLoopRunning) {
            return;
        }
        isMeetingLoopRunning = true;
        let shouldEmitEnded = true;
        try {
            while (sessionId === meetingSessionId) {
                const nextTurn = meetingEngine.getNextTurnContext();
                if (!nextTurn) {
                    const currentState = meetingEngine.getState();
                    if (currentState.status === 'PAUSED') {
                        shouldEmitEnded = false;
                        safeSendToMeeting('meeting-paused', { state: currentState });
                    }
                    break;
                }
                const agent = agentStore.getAgent(nextTurn.agentId);
                if (!agent) {
                    meetingEngine.appendSpeech(
                        { id: nextTurn.agentId, name: nextTurn.agentId },
                        '에이전트 정보를 찾을 수 없습니다.'
                    );
                    continue;
                }
                safeSendToMeeting('meeting-speaker-start', {
                    agentId: agent.id,
                    agentName: agent.name,
                    round: nextTurn.round,
                });
                let fullContent = '';
                try {
                    await apiManager.streamChat(
                        agent.provider,
                        agent.model,
                        agent.persona,
                        nextTurn.messages,
                        (chunk) => {
                            fullContent += chunk;
                            safeSendToMeeting('meeting-chunk', { chunk });
                        },
                        () => { },
                        () => { },
                        agent.apiKey
                    );
                } catch (error) {
                    console.error('회의 발언 스트리밍 실패:', error);
                    fullContent = fullContent || `오류: ${error.message || '응답 생성 실패'}`;
                }
                const speech = meetingEngine.appendSpeech(agent, fullContent);
                safeSendToMeeting('meeting-speaker-end', {
                    agentId: speech.agentId,
                    agentName: speech.agentName,
                    round: speech.round,
                    content: speech.content,
                });
            }
        } finally {
            isMeetingLoopRunning = false;
            if (shouldEmitEnded && sessionId === meetingSessionId) {
                safeSendToMeeting('meeting-ended');
            }
        }
    }
    ipcMain.handle('ai-improve-persona', async (event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const instruction = ensureMessageContent(payload?.instruction);
            const targetAgent = agentStore.getAgent(agentId);
            if (!targetAgent) {
                throw new Error('대상 에이전트를 찾을 수 없습니다.');
            }
            const orchestrator = agentStore.getAgent('agent-1');
            if (!orchestrator) {
                throw new Error('오케스트레이터(agent-1)를 찾을 수 없습니다.');
            }
            const systemPrompt = '현재 페르소나를 보고 사용자 지시에 따라 개선된 페르소나 텍스트만 반환해줘.';
            const messages = [{ role: 'user', content: buildPersonaImprovePrompt(targetAgent, instruction) }];
            let suggestion = '';
            await apiManager.streamChat(
                orchestrator.provider,
                orchestrator.model,
                systemPrompt,
                messages,
                (chunk) => {
                    suggestion += chunk;
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('persona-stream-chunk', { chunk });
                    }
                },
                () => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('persona-stream-end');
                    }
                },
                () => { },
                orchestrator.apiKey
            );
            return { ok: true, suggestion: suggestion.trim() };
        } catch (error) {
            if (!event.sender.isDestroyed()) {
                event.sender.send('persona-stream-error', {
                    message: error.message || '페르소나 AI 개선에 실패했습니다.',
                });
            }
            return { ok: false, error: error.message || '페르소나 AI 개선에 실패했습니다.' };
        }
    });
    ipcMain.handle('start-meeting', async (event, payload) => {
        try {
            if (isMeetingLoopRunning) {
                throw new Error('이미 회의가 진행 중입니다.');
            }
            const topic = typeof payload?.topic === 'string' ? payload.topic.trim() : '';
            const participantIds = Array.isArray(payload?.participantIds)
                ? payload.participantIds.map((id) => ensureAgentId(id, 'participantId'))
                : [];
            const state = meetingEngine.startMeeting(topic, participantIds, payload?.maxRounds);
            meetingSessionId += 1;
            const startedSessionId = meetingSessionId;
            meetingSender = event.sender;
            runMeetingLoop(startedSessionId).catch((error) => {
                console.error('회의 루프 처리 실패:', error);
                if (startedSessionId === meetingSessionId) {
                    safeSendToMeeting('meeting-ended');
                }
            });
            return { ok: true, state };
        } catch (error) {
            return { ok: false, error: error.message || '회의 시작에 실패했습니다.' };
        }
    });
    ipcMain.handle('pause-meeting', async () => {
        try {
            return { ok: true, state: meetingEngine.requestPause() };
        } catch (error) {
            return { ok: false, error: error.message || '회의 일시정지에 실패했습니다.' };
        }
    });
    ipcMain.handle('resume-meeting', async (event) => {
        try {
            const current = meetingEngine.getState();
            if (current.status !== 'PAUSED') {
                throw new Error('회의가 일시정지 상태가 아닙니다.');
            }
            if (isMeetingLoopRunning) {
                throw new Error('회의 루프가 아직 종료되지 않았습니다.');
            }
            const state = meetingEngine.resumeMeeting();
            meetingSessionId += 1;
            const resumedSessionId = meetingSessionId;
            meetingSender = event.sender;
            runMeetingLoop(resumedSessionId).catch((error) => {
                console.error('회의 재개 루프 처리 실패:', error);
                if (resumedSessionId === meetingSessionId) {
                    safeSendToMeeting('meeting-ended');
                }
            });
            return { ok: true, state };
        } catch (error) {
            return { ok: false, error: error.message || '회의 재개에 실패했습니다.' };
        }
    });
    ipcMain.handle('send-meeting-message', async (_event, payload) => {
        try {
            const content = ensureMessageContent(payload?.content);
            const current = meetingEngine.getState();
            if (current.status !== 'PAUSED') {
                throw new Error('회의가 일시정지 상태일 때만 사용자 발언을 보낼 수 있습니다.');
            }
            const speech = meetingEngine.appendUserSpeech(content);
            return { ok: true, speech };
        } catch (error) {
            return { ok: false, error: error.message || '사용자 발언 저장에 실패했습니다.' };
        }
    });
    ipcMain.handle('stop-meeting', async () => {
        const state = meetingEngine.stopMeeting();
        if (!isMeetingLoopRunning) {
            safeSendToMeeting('meeting-ended');
        }
        return { ok: true, state };
    });
    ipcMain.handle('get-meeting-state', async () => meetingEngine.getState());
    ipcMain.handle('export-chat', async (_event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const agent = agentStore.getAgent(agentId);
            if (!agent) {
                throw new Error('에이전트를 찾을 수 없습니다.');
            }
            const history = agentStore.getChatHistory(agentId);
            const defaultFileName = `${agent.name}-chat-${new Date().toISOString().slice(0, 10)}.txt`;
            const result = await dialog.showSaveDialog({
                title: '대화 기록 내보내기',
                defaultPath: path.join(app.getPath('documents'), defaultFileName),
                filters: [{ name: 'Text', extensions: ['txt'] }],
            });
            if (result.canceled || !result.filePath) {
                return { ok: false, canceled: true };
            }
            const content = buildChatExportText(agent, history);
            fs.writeFileSync(result.filePath, content, 'utf8');
            return { ok: true, filePath: result.filePath };
        } catch (error) {
            return { ok: false, error: error.message || '대화 기록 내보내기에 실패했습니다.' };
        }
    });
    ipcMain.handle('export-meeting', async () => {
        try {
            const meetingState = meetingEngine.getState();
            const history = Array.isArray(meetingState?.history) ? meetingState.history : [];
            if (history.length === 0) {
                return { ok: false, error: '내보낼 회의 기록이 없습니다.' };
            }
            const defaultFileName = `meeting-${new Date().toISOString().slice(0, 10)}.txt`;
            const result = await dialog.showSaveDialog({
                title: '회의 기록 내보내기',
                defaultPath: path.join(app.getPath('documents'), defaultFileName),
                filters: [{ name: 'Text', extensions: ['txt'] }],
            });
            if (result.canceled || !result.filePath) {
                return { ok: false, canceled: true };
            }
            const content = buildMeetingExportText(meetingState);
            fs.writeFileSync(result.filePath, content, 'utf8');
            return { ok: true, filePath: result.filePath };
        } catch (error) {
            return { ok: false, error: error.message || '회의 기록 내보내기에 실패했습니다.' };
        }
    });
    ipcMain.handle('send-message', async (event, payload) => {
        try {
            const agentId = ensureAgentId(payload?.agentId);
            const content = ensureMessageContent(payload?.content);
            const agent = agentStore.getAgent(agentId);
            if (!agent) {
                throw new Error('에이전트 정보를 찾을 수 없습니다.');
            }
            const userMessage = createMessage('user', content, agentId);
            agentStore.appendMessage(agentId, userMessage);
            const history = agentStore.getChatHistory(agentId);
            let assistantContent = '';
            await apiManager.streamChat(
                agent.provider,
                agent.model,
                agent.persona,
                history,
                (chunk) => {
                    assistantContent += chunk;
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('stream-chunk', { chunk });
                    }
                },
                () => { },
                () => { },
                agent.apiKey
            );
            const finalAssistantContent = assistantContent.trim();
            if (finalAssistantContent) {
                const assistantMessage = createMessage('assistant', finalAssistantContent, agentId);
                agentStore.appendMessage(agentId, assistantMessage);
            }
            if (!event.sender.isDestroyed()) {
                event.sender.send('stream-end');
            }
            return { ok: true };
        } catch (error) {
            console.error('send-message 처리 실패:', error);
            if (!event.sender.isDestroyed()) {
                event.sender.send('stream-error', {
                    message: error.message || '응답 생성 중 오류가 발생했습니다.',
                });
            }
            return { ok: false, error: error.message || '응답 생성 중 오류가 발생했습니다.' };
        }
    });
}
module.exports = { registerChatMeetingHandlers };
