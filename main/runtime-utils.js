const fs = require('fs');
const path = require('path');

function serializeError(errorLike) {
    if (errorLike instanceof Error) {
        return errorLike.stack || errorLike.message || String(errorLike);
    }
    if (typeof errorLike === 'string') {
        return errorLike;
    }
    try {
        return JSON.stringify(errorLike);
    } catch (_error) {
        return String(errorLike);
    }
}

function appendCrashLog(crashLogPath, type, errorLike) {
    const timestamp = new Date().toISOString();
    const payload = serializeError(errorLike);
    const entry = `[${timestamp}] [${type}]\n${payload}\n\n`;

    try {
        fs.mkdirSync(path.dirname(crashLogPath), { recursive: true });
        fs.appendFileSync(crashLogPath, entry, 'utf8');
    } catch (error) {
        console.error('크래시 로그 저장 실패:', error);
    }
}

function registerProcessErrorHandlers({ app, dialog, crashLogPath }) {
    process.on('unhandledRejection', (reason) => {
        appendCrashLog(crashLogPath, 'unhandledRejection', reason);
    });

    process.on('uncaughtException', (error) => {
        const details = serializeError(error);
        try {
            dialog.showErrorBox('AI Orchestra 오류', details.slice(0, 2000));
        } catch (_dialogError) {
            // Dialog 호출 실패 시에도 종료 전 로그는 남긴다.
        }
        appendCrashLog(crashLogPath, 'uncaughtException', error);
        app.exit(1);
    });
}

function createMessage(role, content, agentId) {
    return {
        id: `msg-${Date.now()}`,
        role,
        content,
        timestamp: Date.now(),
        agentId,
    };
}

function buildPersonaImprovePrompt(agent, instruction) {
    const lines = [
        `대상 에이전트: ${agent.name}`,
        '현재 페르소나:',
        agent.persona || '(없음)',
        '',
        `사용자 지시: ${instruction}`,
        '',
        '요구사항:',
        '- 지시를 반영한 개선된 페르소나만 출력',
        '- 설명/서론/불릿 없이 최종 페르소나 본문만 출력',
        '- 한국어로 출력',
    ];
    return lines.join('\n');
}

module.exports = {
    registerProcessErrorHandlers,
    createMessage,
    buildPersonaImprovePrompt,
};
