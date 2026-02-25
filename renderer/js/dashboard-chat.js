function createDashboardChatController({ state, ui }) {
    function formatTimestamp(timestamp) {
        return new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(timestamp));
    }

    function scrollToBottom() {
        const container = ui.chatMessages();
        if (!container) {
            return;
        }
        container.scrollTop = container.scrollHeight;
    }

    function showToast(message) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        window.setTimeout(() => {
            toast.classList.remove('visible');
        }, 2600);
    }

    function renderAssistantMarkdown(content) {
        if (typeof content !== 'string') {
            return '';
        }
        if (typeof window.renderMarkdown === 'function') {
            return window.renderMarkdown(content);
        }
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function applyAssistantContent(contentEl, content) {
        if (!contentEl) {
            return;
        }
        contentEl.innerHTML = renderAssistantMarkdown(content);
    }

    function setStreamingState(isStreaming) {
        state.isStreaming = isStreaming;
        const messageInput = ui.messageInput();
        const sendButton = ui.sendButton();
        const statusLabel = ui.statusLabel();
        const hasInput = messageInput ? messageInput.value.trim().length > 0 : false;

        if (messageInput) {
            messageInput.disabled = isStreaming;
        }
        if (sendButton) {
            sendButton.disabled = isStreaming || !hasInput;
        }
        if (statusLabel) {
            statusLabel.textContent = isStreaming ? 'AI가 응답 중...' : '';
        }
    }

    function updateSendButtonState() {
        if (state.isStreaming) {
            return;
        }
        const messageInput = ui.messageInput();
        const sendButton = ui.sendButton();
        if (!messageInput || !sendButton) {
            return;
        }
        sendButton.disabled = messageInput.value.trim().length === 0;
    }

    function createMessageElement(message, options = {}) {
        const messageEl = document.createElement('article');
        messageEl.className = `message ${message.role}`;
        if (options.streaming) {
            messageEl.classList.add('streaming');
        }

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        const safeContent = message.content || '';

        if (message.role === 'assistant' && !options.streaming) {
            applyAssistantContent(contentEl, safeContent);
        } else {
            contentEl.textContent = safeContent;
        }

        messageEl.appendChild(contentEl);

        const timestampEl = document.createElement('time');
        timestampEl.className = 'message-timestamp';
        timestampEl.textContent = formatTimestamp(message.timestamp || Date.now());
        messageEl.appendChild(timestampEl);

        return { messageEl, contentEl };
    }

    function appendMessage(message, options = {}) {
        const container = ui.chatMessages();
        if (!container) {
            return null;
        }
        const { messageEl, contentEl } = createMessageElement(message, options);
        container.appendChild(messageEl);
        scrollToBottom();
        return { messageEl, contentEl };
    }

    function renderHistory(history) {
        const container = ui.chatMessages();
        if (!container) {
            return;
        }
        container.innerHTML = '';
        history.forEach((message) => {
            appendMessage(message);
        });
    }

    async function loadChatHistory(agentId) {
        const history = await window.electronAPI.getChatHistory(agentId);
        renderHistory(Array.isArray(history) ? history : []);
    }

    function finalizeStreamingMessage() {
        if (state.streamingMessageEl) {
            state.streamingMessageEl.classList.remove('streaming');
        }
        state.streamingMessageEl = null;
        state.streamingContentEl = null;
        setStreamingState(false);
    }

    function handleStreamChunk(data) {
        const chunk = typeof data?.chunk === 'string' ? data.chunk : '';
        if (!chunk) {
            return;
        }

        if (!state.streamingMessageEl || !state.streamingContentEl) {
            const inserted = appendMessage(
                {
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now(),
                },
                { streaming: true }
            );
            state.streamingMessageEl = inserted?.messageEl || null;
            state.streamingContentEl = inserted?.contentEl || null;
        }

        if (state.streamingContentEl) {
            state.streamingContentEl.textContent += chunk;
            scrollToBottom();
        }
    }

    function handleStreamEnd() {
        if (state.streamingContentEl) {
            const finalContent = state.streamingContentEl.textContent || '';
            applyAssistantContent(state.streamingContentEl, finalContent);
        }
        finalizeStreamingMessage();
    }

    function handleStreamError(data) {
        const message = data?.message || '응답 생성 중 오류가 발생했습니다.';
        if (state.streamingContentEl && !state.streamingContentEl.textContent.trim()) {
            state.streamingContentEl.textContent = `⚠️ ${message}`;
            state.streamingContentEl.classList.add('error-content');
        }
        finalizeStreamingMessage();
    }

    async function submitMessage() {
        if (state.isStreaming) {
            return;
        }

        const messageInput = ui.messageInput();
        if (!messageInput) {
            return;
        }

        const content = messageInput.value.trim();
        if (!content) {
            return;
        }

        appendMessage({
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now(),
            agentId: state.agentId,
        });

        messageInput.value = '';
        setStreamingState(true);

        const inserted = appendMessage(
            {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                agentId: state.agentId,
            },
            { streaming: true }
        );
        state.streamingMessageEl = inserted?.messageEl || null;
        state.streamingContentEl = inserted?.contentEl || null;

        try {
            await window.electronAPI.sendMessage(state.agentId, content);
        } catch (error) {
            handleStreamError({ message: error.message || '메시지 전송에 실패했습니다.' });
        }
    }

    async function clearHistory() {
        if (!state.agentId) {
            return;
        }
        const confirmed = window.confirm('해당 에이전트의 대화 기록을 모두 삭제할까요?');
        if (!confirmed) {
            return;
        }

        try {
            await window.electronAPI.clearHistory(state.agentId);
            renderHistory([]);
            showToast('대화 기록을 초기화했습니다.');
        } catch (error) {
            showToast(error.message || '대화 기록 초기화에 실패했습니다.');
        }
    }

    async function exportChat() {
        if (!state.agentId || !window.electronAPI?.exportChat) {
            return;
        }

        try {
            const result = await window.electronAPI.exportChat(state.agentId);
            if (!result?.ok) {
                if (result?.canceled) {
                    return;
                }
                throw new Error(result?.error || '내보내기에 실패했습니다.');
            }
            showToast('대화 기록을 저장했습니다.');
        } catch (error) {
            showToast(error.message || '대화 기록 저장 실패');
        }
    }

    return {
        showToast,
        updateSendButtonState,
        loadChatHistory,
        submitMessage,
        clearHistory,
        exportChat,
        handleStreamChunk,
        handleStreamEnd,
        handleStreamError,
    };
}

window.createDashboardChatController = createDashboardChatController;
