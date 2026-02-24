(function () {
    const state = {
        mode: 'system',
        effective: 'dark',
        initialized: false,
    };

    function themeIcon(mode) {
        if (mode === 'dark') {
            return '🌙';
        }
        if (mode === 'light') {
            return '☀️';
        }
        return '🖥️';
    }

    function themeLabel(mode) {
        if (mode === 'dark') {
            return '다크 모드';
        }
        if (mode === 'light') {
            return '라이트 모드';
        }
        return '시스템 모드';
    }

    function applyEffectiveTheme(effective) {
        const next = effective === 'light' ? 'light' : 'dark';
        state.effective = next;
        document.documentElement.setAttribute('data-theme', next);
    }

    function updateThemeButtons() {
        const buttons = document.querySelectorAll('[data-theme-toggle]');
        buttons.forEach((button) => {
            button.textContent = themeIcon(state.mode);
            button.title = `테마: ${themeLabel(state.mode)} (클릭해서 변경)`;
            button.setAttribute('aria-label', button.title);
            button.setAttribute('data-theme-mode', state.mode);
        });
    }

    function nextMode(current) {
        if (current === 'system') {
            return 'dark';
        }
        if (current === 'dark') {
            return 'light';
        }
        return 'system';
    }

    async function initTheme() {
        if (!window.electronAPI || typeof window.electronAPI.getTheme !== 'function') {
            return;
        }

        try {
            const theme = await window.electronAPI.getTheme();
            state.mode = theme?.saved || 'system';
            applyEffectiveTheme(theme?.effective || 'dark');
            updateThemeButtons();
        } catch (error) {
            console.error('테마 초기화 실패:', error);
        }
    }

    async function toggleTheme() {
        if (!window.electronAPI || typeof window.electronAPI.setTheme !== 'function') {
            return;
        }

        const targetMode = nextMode(state.mode);

        try {
            const result = await window.electronAPI.setTheme(targetMode);
            if (!result?.ok) {
                throw new Error(result?.error || '테마 저장 실패');
            }
            state.mode = result.saved || targetMode;
            applyEffectiveTheme(result.effective || (state.mode === 'light' ? 'light' : 'dark'));
            updateThemeButtons();
        } catch (error) {
            console.error('테마 변경 실패:', error);
        }
    }

    function bindThemeButtons() {
        const buttons = document.querySelectorAll('[data-theme-toggle]');
        buttons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                toggleTheme();
            });
        });
    }

    function bindSystemThemeListener() {
        if (!window.electronAPI || typeof window.electronAPI.onSystemThemeChanged !== 'function') {
            return;
        }

        window.electronAPI.onSystemThemeChanged((payload) => {
            const saved = payload?.saved || state.mode;
            if (saved === 'system') {
                state.mode = 'system';
                const effective = payload?.effective || (payload?.isDark ? 'dark' : 'light');
                applyEffectiveTheme(effective);
                updateThemeButtons();
                return;
            }

            if (saved === 'dark' || saved === 'light') {
                state.mode = saved;
                applyEffectiveTheme(saved);
                updateThemeButtons();
            }
        });
    }

    function setupTheme() {
        if (state.initialized) {
            return;
        }
        state.initialized = true;
        initTheme();
        bindThemeButtons();
        bindSystemThemeListener();
    }

    window.initTheme = initTheme;
    window.toggleTheme = toggleTheme;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTheme);
    } else {
        setupTheme();
    }
})();
