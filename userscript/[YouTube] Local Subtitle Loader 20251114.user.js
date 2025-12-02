// ==UserScript==
// @name         [YouTube] Outside Subtitle [20251202] v2.2.0
// @namespace    0_V userscripts/[YouTube] Outside Subtitle
// @description  Adds a button to load local SRT/VTT subtitles on YouTube. Works with YouTube's single-page design and supports mobile.
// @license      MIT
// @version      [20251202] v2.2.0
// @update-log   2025-12-02: v2.1.0 refreshes the YouTube-native settings panel, defaults Drive auto-load on, and swaps single/double-click actions; 2025-12-02: add Google Drive picker with oEmbed-aware sorting + credential tab; 2025-11-23: refactor into numbered modules under src/ with a bundler outputting dist/[YouTube] Local Subtitle Loader.user.js
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      oauth2.googleapis.com
// @connect      www.googleapis.com
// @connect      www.youtube.com
// @match        https://www.youtube.com/*
// @icon         https://github.com/0-V-linuxdo/YouTube-Outside-Subtitle/raw/refs/heads/main/main_icon/main_icon.svg
// ==/UserScript==

/* ===================== IMPORTANT · NOTICE · START =====================
 *
 * 1. [编辑指引 | Edit Guidance]
 *    • ⚠️ 这是一个自动生成的文件：请在 `src/modules` 目录下的模块中进行修改，然后运行 `npm run build` 在 `dist/` 目录下重新生成。
 *    • ⚠️ This project bundles auto-generated artifacts. Make changes inside the modules under `src/modules`, then run `npm run build` to regenerate everything under `dist/`.
 *
 * ----------------------------------------------------------------------
 *
 * 2. [安全提示 | Safety Reminder]
 *    • ✅ 必须使用 `setTrustedHTML`，不得使用 `innerHTML`。
 *    • ✅ Always call `setTrustedHTML`; never rely on `innerHTML`.
 *
 * ====================== IMPORTANT · NOTICE · END ======================
 */

/* -------------------------------------------------------------------------- *
 * Module 01 · Config, localization, and settings management helpers
 * -------------------------------------------------------------------------- */

(function() {
    'use strict';

    // --- 在这里自定义字幕样式 ---
    const SETTINGS_STORAGE_KEY = 'localSubtitleLoaderSettings';
    const DRIVE_SETTINGS_STORAGE_KEY = 'localSubtitleLoaderDriveConfig';
    const DEFAULT_SETTINGS = {
        fontSize: 36,            // 像素
        color: '#ffffff',
        shadowColor: '#000000',
        bottom: 8,               // 百分比
        lineHeight: 1.4,
        buttonEffect: 'bar',     // bar | pulse
        language: 'auto',        // auto | zh | en
        autoDriveLoad: true
    };
    const DEFAULT_DRIVE_SETTINGS = {
        clientId: '',
        clientSecret: '',
        refreshToken: ''
    };

    const I18N = {
        zh: {
            menuTitle: '本地字幕设置',
            settingsTitle: '字幕设置',
            tabs: {
                appearance: '样式',
                language: '语言',
                drive: '云盘',
                auto: '自动'
            },
            fields: {
                fontSize: '字体大小',
                bottomOffset: '距离底部',
                lineHeight: '行高',
                fontColor: '字体颜色',
                shadowColor: '描边/阴影颜色',
                buttonEffect: '按钮加载效果'
            },
            drive: {
                menuLoad: '从 Google Drive 读取字幕',
                menuConfigure: '设置 Google Drive 凭证',
                prompts: {
                    clientId: '请输入 Google OAuth Client ID（留空保持不变）',
                    clientSecret: '请输入 Client Secret（留空保持不变）',
                    refreshToken: '请输入 Refresh Token（留空保持不变）',
                    selection: count => `输入要加载的文件序号（1-${count}）或直接输入文件 ID：`
                },
                messages: {
                    saved: 'Google Drive 凭证已保存。',
                    missingConfig: '请先设置 Google Drive 凭证（Client ID、Client Secret、Refresh Token）。',
                    loading: '正在从 Google Drive 加载字幕...',
                    noFiles: '没有获取到任何 Drive 文件，请检查 API 权限。',
                    invalidSelection: '选择无效，未找到对应的文件。',
                    unsupportedType: '仅支持以 .srt 或 .vtt 结尾的字幕文件。',
                    downloadFailed: '读取 Google Drive 文件失败，请查看控制台。',
                    parseFailed: '解析云盘文件失败，请确认格式是否为有效的 SRT/VTT。',
                    gmUnavailable: '当前环境缺少 GM_xmlhttpRequest，无法调用 Google Drive API。',
                    permissionDenied: '此帐号尚未授权本应用访问该文件。请先用同一帐号打开该文件或将其共享给应用。'
                },
                panel: {
                    description: '在下面填入你自己的 Google OAuth 凭证。数据仅保存在本地浏览器中。',
                    helper: '凭证保存后即可在菜单里直接打开云盘字幕文件。',
                    fields: {
                        clientId: 'OAuth Client ID',
                        clientSecret: 'Client Secret',
                        refreshToken: 'Refresh Token'
                    },
                    actions: {
                        openPicker: '打开云盘文件选择器',
                        clear: '清空凭证'
                    }
                },
                picker: {
                    title: '选择 Google Drive 字幕',
                    loading: '正在加载云盘字幕文件……',
                    hint: '点击下方任意文件即可加载字幕。',
                    empty: '未找到任何 .srt 或 .vtt 文件。',
                    matchPrefix: '匹配度',
                    retry: '重试',
                    close: '关闭',
                    loadingFile: name => `正在加载：${name}`,
                    error: '无法获取文件列表，请稍后再试。'
                }
            },
            automation: {
                title: '自动化',
                driveAutoLoad: '自动从 Drive 获取字幕并应用',
                driveHint: '在每次进入视频页面时自动匹配并拉取云盘字幕。'
            },
            buttonEffectOptions: {
                bar: '进度条高亮',
                pulse: '呼吸光圈'
            },
            buttonStates: {
                default: '未加载',
                loading: '加载中...',
                loaded: '已加载'
            },
            buttonAria: '加载本地字幕',
            reset: '恢复默认',
            languageNote: '默认使用浏览器语言（检测到中文则中文，否则英文）。',
            languageOptions: {
                auto: 'auto',
                zh: '中文',
                en: 'english'
            },
            messages: {
                invalidFile: '请选择有效的字幕文件（.srt 或 .vtt 格式）。',
                parseSuccess: count => `字幕加载成功！共 ${count} 条。`,
                parseFailed: '无法解析字幕文件，请检查文件格式是否正确 (支持 SRT 和 VTT) 或文件编码是否为 UTF-8。',
                readError: '文件读取失败，请重试。'
            }
        },
        en: {
            menuTitle: 'Local Subtitle Settings',
            settingsTitle: 'Subtitle Settings',
            tabs: {
                appearance: 'Appearance',
                language: 'Language',
                drive: 'Drive',
                auto: 'Auto'
            },
            fields: {
                fontSize: 'Font Size',
                bottomOffset: 'Bottom Offset',
                lineHeight: 'Line Height',
                fontColor: 'Font Color',
                shadowColor: 'Stroke/Shadow Color',
                buttonEffect: 'Button Loading Effect'
            },
            drive: {
                menuLoad: 'Load subtitles from Google Drive',
                menuConfigure: 'Configure Google Drive credentials',
                prompts: {
                    clientId: 'Enter the Google OAuth Client ID (leave blank to keep current)',
                    clientSecret: 'Enter the Client Secret (leave blank to keep current)',
                    refreshToken: 'Enter the Refresh Token (leave blank to keep current)',
                    selection: count => `Enter the file number (1-${count}) or paste a file ID:`
                },
                messages: {
                    saved: 'Google Drive credentials saved.',
                    missingConfig: 'Please configure the Google Drive Client ID/Secret/Refresh Token first.',
                    loading: 'Loading subtitles from Google Drive...',
                    noFiles: 'No Drive files found. Check your API scope.',
                    invalidSelection: 'Invalid selection, no file matched that index or ID.',
                    unsupportedType: 'Only .srt and .vtt files are supported.',
                    downloadFailed: 'Failed to download the selected Drive file. Check the console for details.',
                    parseFailed: 'Could not parse the Drive file. Ensure it is a valid SRT/VTT.',
                    gmUnavailable: 'GM_xmlhttpRequest is required for Google Drive access but is not available.',
                    permissionDenied: 'This app is not authorized to read that file. Open/share it with the same Google account first.'
                },
                panel: {
                    description: 'Store your own Google OAuth credentials locally to access Drive files.',
                    helper: 'Once saved you can launch the Drive picker directly from the menu.',
                    fields: {
                        clientId: 'OAuth Client ID',
                        clientSecret: 'Client Secret',
                        refreshToken: 'Refresh Token'
                    },
                    actions: {
                        openPicker: 'Open Drive picker',
                        clear: 'Clear credentials'
                    }
                },
                picker: {
                    title: 'Select a Google Drive subtitle',
                    loading: 'Fetching subtitle files from Drive…',
                    hint: 'Click any file below to load it as subtitles.',
                    empty: 'No .srt or .vtt files were found.',
                    matchPrefix: 'Match',
                    retry: 'Retry',
                    close: 'Close',
                    loadingFile: name => `Loading ${name}…`,
                    error: 'Unable to fetch the file list. Please try again later.'
                }
            },
            automation: {
                title: 'Automation',
                driveAutoLoad: 'Automatically fetch subtitles from Drive',
                driveHint: 'Attempts to match every video with your Drive subtitles.'
            },
            buttonEffectOptions: {
                bar: 'Progress Highlight',
                pulse: 'Pulse Ring'
            },
            buttonStates: {
                default: 'Not loaded',
                loading: 'Loading...',
                loaded: 'Loaded'
            },
            buttonAria: 'Load local subtitles',
            reset: 'Reset to Defaults',
            languageNote: 'Auto picks the browser language (Chinese -> Chinese, otherwise English).',
            languageOptions: {
                auto: 'auto',
                zh: '中文',
                en: 'english'
            },
            messages: {
                invalidFile: 'Please select a valid subtitle file (.srt or .vtt).',
                parseSuccess: count => `Subtitles loaded! ${count} entries.`,
                parseFailed: 'Could not parse the subtitle file. Ensure it is a valid SRT or VTT encoded in UTF-8.',
                readError: 'Failed to read the file. Please try again.'
            }
        }
    };

    const INLINE_MESSAGE_VARIANTS = {
        info: {
            background: 'rgba(32, 33, 36, 0.95)',
            color: '#ffffff',
            border: 'rgba(255, 255, 255, 0.18)'
        },
        success: {
            background: 'rgba(62, 180, 99, 0.18)',
            color: '#e3ffe9',
            border: 'rgba(62, 180, 99, 0.75)'
        },
        error: {
            background: 'rgba(140, 33, 32, 0.96)',
            color: '#ffe7e6',
            border: 'rgba(255, 146, 132, 0.85)'
        }
    };

    const SUCCESS_BORDER_COLOR = '#3eb463';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const EXTRA_STYLE_ID = 'local-subtitle-style-block';
    const SINGLE_CLICK_DELAY = 260;
    const TOOLTIP_SHOW_DELAY = 320;
    const TOOLTIP_HIDE_DELAY = 140;
    const TOOLTIP_VERTICAL_GAP = 16;

    let subtitles = [];
    let videoElement = null;
    let subtitleContainer = null;
    let animationFrameId = null;
    let uiInjected = false;
    let themeObserver = null;
    let colorSchemeListener = null;
    let fileInputLabelRef = null;
    let fileInputLabelTextRef = null;
    let completionBarRef = null;
    let inlineMessageRef = null;
    let inlineMessageTimer = null;
    let successHighlightTimer = null;
    let successHighlightOriginalStyle = null;
    let settingsPanelRef = null;
    let settingsActiveTab = 'appearance';
    let currentSettings = { ...DEFAULT_SETTINGS };
    let extraStyleElRef = null;
    let buttonWrapperRef = null;
    let buttonInteractiveRef = null;
    let lastSubtitleText = '';
    let effectPreviewTimer = null;
    let effectPreviewRestoreState = null;
    let singleClickTimer = null;
    let pendingFileInputRef = null;
    let settingsMenuRegistered = false;
    let driveMenuRegistered = false;
    const themeChangeCallbacks = new Set();
    let labelThemeCleanup = null;
    let panelThemeCleanup = null;
    let tooltipElementRef = null;
    let tooltipShowTimer = null;
    let tooltipHideTimer = null;
    let tooltipCurrentTarget = null;
    let tooltipCurrentText = '';
    let buttonTooltipCleanup = null;
    let tooltipThemeCleanup = null;
    let driveSettings = { ...DEFAULT_DRIVE_SETTINGS };
    let driveAccessToken = null;
    let driveAccessTokenExpireAt = 0;
    let driveSelectionInProgress = false;

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function isValidHexColor(value) {
        return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
    }

    function detectBrowserLanguage() {
        const languages = [];
        if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
            languages.push(...navigator.languages);
        }
        if (navigator.language) {
            languages.push(navigator.language);
        }
        const primary = languages.find(Boolean)?.toLowerCase() || 'en';
        return primary.includes('zh') ? 'zh' : 'en';
    }

    function getActiveLanguage() {
        const pref = (currentSettings.language || 'auto').toLowerCase();
        if (pref === 'zh' || pref.startsWith('zh')) {
            return 'zh';
        }
        if (pref === 'en') {
            return 'en';
        }
        return detectBrowserLanguage();
    }

    function getLocaleStrings() {
        const lang = getActiveLanguage();
        return I18N[lang] || I18N.en;
    }

    function getButtonStateText(state) {
        const dict = getLocaleStrings().buttonStates || {};
        const fallback = I18N.en.buttonStates;
        return dict[state] || fallback[state] || '';
    }

    function getLanguageOptionLabel(value) {
        const dict = getLocaleStrings().languageOptions || {};
        const fallback = I18N.en.languageOptions;
        return dict[value] || fallback[value] || value;
    }

    function getLocalizedMessage(key, payload) {
        const dict = getLocaleStrings().messages || {};
        const fallback = I18N.en.messages;
        const message = dict[key] ?? fallback[key];
        if (typeof message === 'function') {
            return message(payload);
        }
        return message || '';
    }


    function getDriveStrings() {
        const dict = getLocaleStrings().drive || {};
        const fallback = I18N.en.drive;
        return {
            menuLoad: dict.menuLoad || fallback.menuLoad,
            menuConfigure: dict.menuConfigure || fallback.menuConfigure,
            prompts: {
                clientId: dict.prompts?.clientId || fallback.prompts.clientId,
                clientSecret: dict.prompts?.clientSecret || fallback.prompts.clientSecret,
                refreshToken: dict.prompts?.refreshToken || fallback.prompts.refreshToken,
                selection: typeof dict.prompts?.selection === 'function'
                    ? dict.prompts.selection
                    : fallback.prompts.selection
            },
            messages: {
                saved: dict.messages?.saved || fallback.messages.saved,
                missingConfig: dict.messages?.missingConfig || fallback.messages.missingConfig,
                loading: dict.messages?.loading || fallback.messages.loading,
                noFiles: dict.messages?.noFiles || fallback.messages.noFiles,
                invalidSelection: dict.messages?.invalidSelection || fallback.messages.invalidSelection,
                unsupportedType: dict.messages?.unsupportedType || fallback.messages.unsupportedType,
                downloadFailed: dict.messages?.downloadFailed || fallback.messages.downloadFailed,
                parseFailed: dict.messages?.parseFailed || fallback.messages.parseFailed,
                gmUnavailable: dict.messages?.gmUnavailable || fallback.messages.gmUnavailable,
                permissionDenied: dict.messages?.permissionDenied || fallback.messages.permissionDenied
            },
            panel: {
                description: dict.panel?.description || fallback.panel.description,
                helper: dict.panel?.helper || fallback.panel.helper,
                fields: {
                    clientId: dict.panel?.fields?.clientId || fallback.panel.fields.clientId,
                    clientSecret: dict.panel?.fields?.clientSecret || fallback.panel.fields.clientSecret,
                    refreshToken: dict.panel?.fields?.refreshToken || fallback.panel.fields.refreshToken
                },
                actions: {
                    openPicker: dict.panel?.actions?.openPicker || fallback.panel.actions.openPicker,
                    clear: dict.panel?.actions?.clear || fallback.panel.actions.clear
                }
            },
            picker: {
                title: dict.picker?.title || fallback.picker.title,
                loading: dict.picker?.loading || fallback.picker.loading,
                hint: dict.picker?.hint || fallback.picker.hint,
                empty: dict.picker?.empty || fallback.picker.empty,
                matchPrefix: dict.picker?.matchPrefix || fallback.picker.matchPrefix,
                retry: dict.picker?.retry || fallback.picker.retry,
                close: dict.picker?.close || fallback.picker.close,
                loadingFile: typeof dict.picker?.loadingFile === 'function'
                    ? dict.picker.loadingFile
                    : fallback.picker.loadingFile,
                error: dict.picker?.error || fallback.picker.error
            }
        };
    }
/* -------------------------------------------------------------------------- *
 * Module 02 · Style injection and subtitle/button appearance utilities
 * -------------------------------------------------------------------------- */

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) {
                currentSettings = { ...DEFAULT_SETTINGS };
                return;
            }
            const parsed = JSON.parse(raw);
            const next = { ...DEFAULT_SETTINGS };
            if (typeof parsed.fontSize === 'number') {
                next.fontSize = clamp(parsed.fontSize, 18, 72);
            }
            if (typeof parsed.lineHeight === 'number') {
                next.lineHeight = clamp(parsed.lineHeight, 1.1, 2);
            }
            if (typeof parsed.bottom === 'number') {
                next.bottom = clamp(parsed.bottom, 2, 20);
            }
            if (isValidHexColor(parsed.color)) {
                next.color = parsed.color;
            }
            if (isValidHexColor(parsed.shadowColor)) {
                next.shadowColor = parsed.shadowColor;
            }
            if (parsed.buttonEffect === 'pulse' || parsed.buttonEffect === 'bar') {
                next.buttonEffect = parsed.buttonEffect;
            }
            if (parsed.language === 'zh' || parsed.language === 'en' || parsed.language === 'auto') {
                next.language = parsed.language;
            }
            if (typeof parsed.autoDriveLoad === 'boolean') {
                next.autoDriveLoad = parsed.autoDriveLoad;
            }
            currentSettings = next;
        } catch (error) {
            console.warn('Failed to load stored settings, using defaults.', error);
            currentSettings = { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    function loadDriveSettings() {
        try {
            const raw = localStorage.getItem(DRIVE_SETTINGS_STORAGE_KEY);
            if (!raw) {
                driveSettings = { ...DEFAULT_DRIVE_SETTINGS };
                return;
            }
            const parsed = JSON.parse(raw);
            driveSettings = {
                clientId: typeof parsed.clientId === 'string' ? parsed.clientId.trim() : '',
                clientSecret: typeof parsed.clientSecret === 'string' ? parsed.clientSecret.trim() : '',
                refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken.trim() : ''
            };
        } catch (error) {
            console.warn('Failed to load Google Drive settings, using defaults.', error);
            driveSettings = { ...DEFAULT_DRIVE_SETTINGS };
        }
    }

    function saveDriveSettings() {
        try {
            localStorage.setItem(DRIVE_SETTINGS_STORAGE_KEY, JSON.stringify(driveSettings));
        } catch (error) {
            console.warn('Failed to save Google Drive settings:', error);
        }
    }

    function updateDriveSettingValue(key, value) {
        if (!(key in driveSettings)) return;
        const nextValue = typeof value === 'string' ? value.trim() : '';
        if (driveSettings[key] === nextValue) return;
        driveSettings = {
            ...driveSettings,
            [key]: nextValue
        };
        saveDriveSettings();
        resetDriveTokenCache();
    }

    function clearDriveSettings() {
        driveSettings = { ...DEFAULT_DRIVE_SETTINGS };
        saveDriveSettings();
        resetDriveTokenCache();
    }

    function notifyThemeListeners() {
        themeChangeCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Theme listener error:', error);
            }
        });
    }

    function ensureThemeMonitoring() {
        if (!themeObserver) {
            themeObserver = new MutationObserver(() => notifyThemeListeners());
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['dark', 'data-color-mode']
            });
        }
        if (!colorSchemeListener && window.matchMedia) {
            const media = window.matchMedia('(prefers-color-scheme: dark)');
            const listener = () => notifyThemeListeners();
            if (media.addEventListener) {
                media.addEventListener('change', listener);
            } else if (media.addListener) {
                media.addListener(listener);
            }
            colorSchemeListener = { media, listener };
        }
    }

    function registerThemeListener(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }
        themeChangeCallbacks.add(callback);
        ensureThemeMonitoring();
        try {
            callback();
        } catch (error) {
            console.error('Theme listener error:', error);
        }
        return () => {
            themeChangeCallbacks.delete(callback);
            if (themeChangeCallbacks.size === 0) {
                if (themeObserver) {
                    themeObserver.disconnect();
                    themeObserver = null;
                }
                if (colorSchemeListener?.media) {
                    const { media, listener } = colorSchemeListener;
                    if (media.removeEventListener) {
                        media.removeEventListener('change', listener);
                    } else if (media.removeListener) {
                        media.removeListener(listener);
                    }
                    colorSchemeListener = null;
                }
            }
        };
    }

    function ensureExtraStyles() {
        if (extraStyleElRef && document.head.contains(extraStyleElRef)) {
            return;
        }
        const style = document.createElement('style');
        style.id = EXTRA_STYLE_ID;
        style.textContent = `
            @keyframes local-subtitle-pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 78, 69, 0.45); }
                70% { box-shadow: 0 0 0 12px rgba(255, 78, 69, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 78, 69, 0); }
            }
            .local-subtitle-button-wrapper {
                position: relative;
            }
            .local-subtitle-button-wrapper.local-subtitle-pulse-loading::after {
                content: '';
                position: absolute;
                inset: -2px;
                border-radius: 999px;
                pointer-events: none;
                animation: local-subtitle-pulse 1.3s ease-out infinite;
                display: block;
            }
            .local-subtitle-native-tooltip {
                position: fixed;
                left: 0;
                top: 0;
                padding: 8px;
                border-radius: 4px;
                background: var(--local-subtitle-tooltip-bg, #606060);
                color: #ffffff;
                border: 1px solid var(--local-subtitle-tooltip-border, rgba(0, 0, 0, 0.25));
                box-shadow: var(--local-subtitle-tooltip-shadow, 0 4px 14px rgba(0, 0, 0, 0.35));
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transform: translateY(8px);
                transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
                z-index: 2147483647;
                text-align: center;
                max-width: min(260px, calc(100vw - 32px));
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font: 500 12px/1.35 Roboto, Arial, sans-serif;
                letter-spacing: 0.02em;
                min-height: 30px;
                box-sizing: border-box;
                text-transform: none;
            }
            .local-subtitle-native-tooltip[data-visible="true"] {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            #local-subtitle-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(400px, 94vw);
                max-height: min(80vh, 520px);
                --local-subtitle-panel-bg: var(--yt-spec-raised-background, #282828);
                --local-subtitle-panel-text: var(--yt-spec-text-primary, #ffffff);
                --local-subtitle-panel-border: var(--yt-spec-10-percent-layer, rgba(255,255,255,0.12));
                --local-subtitle-panel-field-bg: rgba(255,255,255,0.08);
                --local-subtitle-panel-field-border: rgba(255,255,255,0.12);
                --local-subtitle-panel-field-border-strong: rgba(255,255,255,0.32);
                --local-subtitle-panel-field-active-bg: rgba(255,255,255,0.18);
                --local-subtitle-panel-subtext: var(--yt-spec-text-secondary, rgba(255,255,255,0.7));
                background: var(--local-subtitle-panel-bg);
                color: var(--local-subtitle-panel-text);
                border-radius: 18px;
                padding: 20px;
                box-shadow: 0 18px 40px rgba(0,0,0,0.6);
                z-index: 100000;
                border: 1px solid var(--local-subtitle-panel-border);
                display: flex;
                flex-direction: column;
            }
            #local-subtitle-settings-panel h4 {
                margin: 0;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            #local-subtitle-settings-panel h4 button {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 1px solid transparent;
                background: transparent;
                color: inherit;
                font-size: 18px;
                line-height: 1;
            }
            #local-subtitle-settings-panel label {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 12px;
                margin-bottom: 10px;
            }
            #local-subtitle-settings-panel input,
            #local-subtitle-settings-panel select {
                border-radius: 10px;
                border: 1px solid var(--local-subtitle-panel-field-border);
                background: var(--local-subtitle-panel-field-bg);
                color: var(--local-subtitle-panel-text);
                padding: 8px;
                font-size: 13px;
                outline: none;
            }
            #local-subtitle-settings-panel input[type="range"] {
                padding: 0;
                accent-color: var(--yt-spec-brand-button-background, #ff0033);
            }
            #local-subtitle-settings-panel button {
                border: none;
                background: transparent;
                color: inherit;
                cursor: pointer;
            }
            #local-subtitle-settings-panel .settings-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            #local-subtitle-settings-panel .settings-row span {
                font-size: 12px;
                color: var(--local-subtitle-panel-subtext);
            }
            #local-subtitle-settings-panel .local-subtitle-tab-bar {
                display: flex;
                gap: 8px;
                margin: 14px 0 10px;
                padding-bottom: 6px;
                border-bottom: 1px solid var(--local-subtitle-panel-border);
            }
            #local-subtitle-settings-panel .local-subtitle-tab-bar button {
                flex: 1;
                border-radius: 999px;
                border: 1px solid transparent;
                background: transparent;
                color: var(--local-subtitle-panel-subtext);
                padding: 8px 0;
                font-size: 13px;
                font-weight: 600;
            }
            #local-subtitle-settings-panel .local-subtitle-tab-bar button.active {
                color: var(--local-subtitle-panel-text);
                border-color: var(--local-subtitle-panel-field-border);
                background: rgba(255,255,255,0.08);
            }
            #local-subtitle-settings-panel .local-subtitle-tab-container {
                flex: 1;
                overflow-y: auto;
                padding-right: 4px;
            }
            #local-subtitle-settings-panel .local-subtitle-tab-container::-webkit-scrollbar {
                width: 6px;
            }
            #local-subtitle-settings-panel .local-subtitle-tab-container::-webkit-scrollbar-thumb {
                border-radius: 999px;
                background: rgba(255,255,255,0.18);
            }
            #local-subtitle-settings-panel .local-subtitle-tab-content {
                display: none;
                padding: 12px 0 16px;
                border-bottom: 1px solid var(--local-subtitle-panel-border);
            }
            #local-subtitle-settings-panel .local-subtitle-tab-content:last-of-type {
                border-bottom: none;
            }
            #local-subtitle-settings-panel .local-subtitle-tab-content.active {
                display: block;
            }
            #local-subtitle-settings-panel .local-subtitle-language-options {
                display: flex;
                justify-content: space-between;
                gap: 8px;
            }
            #local-subtitle-settings-panel .local-subtitle-language-option {
                display: inline-flex;
                flex-direction: row;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                padding: 6px 10px 6px 12px;
                border-radius: 999px;
                border: 1px solid var(--local-subtitle-panel-field-border);
                background: var(--local-subtitle-panel-field-bg);
                flex: 1;
                color: var(--local-subtitle-panel-text);
            }
            #local-subtitle-settings-panel .local-subtitle-language-option input {
                width: 16px;
                height: 16px;
                accent-color: var(--yt-spec-brand-button-background, #ff0033);
            }
            #local-subtitle-settings-panel .local-subtitle-language-note {
                margin: 12px 0 0;
                font-size: 12px;
                color: var(--local-subtitle-panel-subtext);
                line-height: 1.4;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-note {
                font-size: 13px;
                color: var(--local-subtitle-panel-text);
                margin: 4px 0 12px;
                line-height: 1.5;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-helper {
                font-size: 12px;
                color: var(--local-subtitle-panel-subtext);
                margin: 8px 0 0;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-fields {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 12px;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 12px;
                color: var(--local-subtitle-panel-subtext);
            }
            #local-subtitle-settings-panel .local-subtitle-drive-field input {
                border-radius: 12px;
                border: 1px solid var(--local-subtitle-panel-field-border);
                background: var(--local-subtitle-panel-field-bg);
                color: var(--local-subtitle-panel-text);
                padding: 8px 12px;
                font-size: 13px;
                outline: none;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-field input:focus {
                border-color: var(--local-subtitle-panel-field-border-strong);
                background: var(--local-subtitle-panel-field-active-bg);
            }
            #local-subtitle-settings-panel .local-subtitle-drive-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-action {
                flex: 1;
                min-width: 0;
                border-radius: 999px;
                border: 1px solid transparent;
                padding: 10px 0;
                font-weight: 600;
                cursor: pointer;
                letter-spacing: 0.2px;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-action.primary {
                background: linear-gradient(135deg, var(--yt-spec-brand-button-background, #ff0033), #c4001d);
                color: #ffffff;
            }
            #local-subtitle-settings-panel .local-subtitle-drive-action.secondary {
                background: transparent;
                color: var(--local-subtitle-panel-text);
                border-color: var(--local-subtitle-panel-field-border);
            }
            #local-subtitle-settings-panel .local-subtitle-drive-action:hover {
                opacity: 0.9;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-options {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-option {
                border-radius: 12px;
                border: 1px solid var(--local-subtitle-panel-field-border);
                background: var(--local-subtitle-panel-field-bg);
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-option-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-option-header span {
                font-weight: 600;
                font-size: 13px;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-option small {
                font-size: 12px;
                color: var(--local-subtitle-panel-subtext);
                line-height: 1.4;
            }
            #local-subtitle-settings-panel .local-subtitle-auto-option input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #ff4e45;
            }
            .local-subtitle-drive-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
            }
            .local-subtitle-drive-backdrop[data-visible="true"] {
                opacity: 1;
                visibility: visible;
            }
            .local-subtitle-drive-panel {
                width: min(420px, calc(100vw - 32px));
                max-height: min(520px, calc(100vh - 32px));
                background: rgba(32, 33, 36, 0.96);
                border-radius: 18px;
                border: 1px solid rgba(255, 255, 255, 0.18);
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(14px);
                display: flex;
                flex-direction: column;
                padding: 18px;
                color: #ffffff;
            }
            .local-subtitle-drive-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            .local-subtitle-drive-panel-header h5 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .local-subtitle-drive-close {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: transparent;
                color: inherit;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
            }
            .local-subtitle-drive-status {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                min-height: 32px;
            }
            .local-subtitle-drive-status-action {
                flex-shrink: 0;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.25);
                background: transparent;
                color: inherit;
                padding: 6px 14px;
                cursor: pointer;
                font-size: 12px;
            }
            .local-subtitle-drive-list {
                margin-top: 12px;
                overflow-y: auto;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-right: 2px;
            }
            .local-subtitle-drive-file {
                border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.05);
                color: inherit;
                text-align: left;
                padding: 10px 12px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 4px;
                transition: border-color 0.2s ease, background 0.2s ease;
            }
            .local-subtitle-drive-file:hover {
                border-color: rgba(255, 255, 255, 0.45);
                background: rgba(255, 255, 255, 0.12);
            }
            .local-subtitle-drive-file-name {
                font-size: 14px;
                font-weight: 600;
            }
            .local-subtitle-drive-file-meta {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.75);
            }
        `;
        document.head.appendChild(style);
        extraStyleElRef = style;
    }

    function applySubtitleStyle() {
        if (!subtitleContainer) return;
        const settings = currentSettings;
        subtitleContainer.style.position = 'absolute';
        subtitleContainer.style.width = '90%';
        subtitleContainer.style.left = '5%';
        subtitleContainer.style.bottom = `${settings.bottom}%`;
        subtitleContainer.style.textAlign = 'center';
        subtitleContainer.style.pointerEvents = 'none';
        subtitleContainer.style.zIndex = '99999';
        subtitleContainer.style.fontSize = `${settings.fontSize}px`;
        subtitleContainer.style.color = settings.color;
        subtitleContainer.style.fontWeight = 'bold';
        subtitleContainer.style.fontFamily = 'Arial, "Heiti SC", "Microsoft Yahei", sans-serif';
        const shadow = `2px 2px 2px ${settings.shadowColor}, -2px -2px 2px ${settings.shadowColor}, 2px -2px 2px ${settings.shadowColor}, -2px 2px 2px ${settings.shadowColor}`;
        subtitleContainer.style.textShadow = shadow;
        subtitleContainer.style.lineHeight = settings.lineHeight.toString();
    }

    function applyButtonEffectSetting(state) {
        if (!buttonWrapperRef) return;
        const effect = currentSettings.buttonEffect;
        if (effect === 'pulse' && state === 'loading') {
            buttonWrapperRef.classList.add('local-subtitle-pulse-loading');
        } else {
            buttonWrapperRef.classList.remove('local-subtitle-pulse-loading');
        }
        if (completionBarRef) {
            const useBar = effect === 'bar';
            completionBarRef.style.display = useBar ? 'block' : 'none';
            if (!useBar) {
                completionBarRef.style.opacity = '0';
                completionBarRef.style.transform = 'scaleX(0)';
            }
        }
    }
/* -------------------------------------------------------------------------- *
 * Module 03 · Settings panel creation, tabs, and controls
 * -------------------------------------------------------------------------- */

    function createLabeledInput(labelText, inputElement, valueRenderer) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const row = document.createElement('div');
        row.className = 'settings-row';
        const valueText = document.createElement('span');
        if (valueRenderer) {
            valueText.textContent = valueRenderer();
        }
        inputElement.addEventListener('input', () => {
            if (valueRenderer) {
                valueText.textContent = valueRenderer();
            }
        });
        row.appendChild(inputElement);
        row.appendChild(valueText);
        label.appendChild(row);
        return label;
    }

    function buildSettingsPanel() {
        ensureExtraStyles();
        if (settingsPanelRef) return settingsPanelRef;
        const strings = getLocaleStrings();
        const panel = document.createElement('div');
        panel.id = 'local-subtitle-settings-panel';
        panel.style.display = 'none';

        const header = document.createElement('h4');
        header.textContent = strings.settingsTitle;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.padding = '0 6px';
        closeBtn.addEventListener('click', () => toggleSettingsPanel(false));
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const tabBar = document.createElement('div');
        tabBar.className = 'local-subtitle-tab-bar';
        const appearanceContent = document.createElement('div');
        appearanceContent.className = 'local-subtitle-tab-content';
        appearanceContent.dataset.tabContent = 'appearance';
        const languageContent = document.createElement('div');
        languageContent.className = 'local-subtitle-tab-content';
        languageContent.dataset.tabContent = 'language';
        const driveContent = document.createElement('div');
        driveContent.className = 'local-subtitle-tab-content';
        driveContent.dataset.tabContent = 'drive';
        const automationContent = document.createElement('div');
        automationContent.className = 'local-subtitle-tab-content';
        automationContent.dataset.tabContent = 'auto';

        function createTabButton(key, label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.tabButton = key;
            button.textContent = label;
            button.addEventListener('click', () => {
                settingsActiveTab = key;
                syncSettingsTabs();
            });
            tabBar.appendChild(button);
        }

        createTabButton('appearance', strings.tabs.appearance);
        createTabButton('language', strings.tabs.language);
        createTabButton('drive', strings.tabs.drive);
        createTabButton('auto', strings.tabs.auto);
        panel.appendChild(tabBar);

        const fontSizeInput = document.createElement('input');
        fontSizeInput.type = 'range';
        fontSizeInput.min = '18';
        fontSizeInput.max = '72';
        fontSizeInput.step = '1';
        fontSizeInput.value = `${currentSettings.fontSize}`;
        fontSizeInput.addEventListener('input', () => {
            currentSettings.fontSize = clamp(Number(fontSizeInput.value), 18, 72);
            saveSettings();
            applySubtitleStyle();
        });
        appearanceContent.appendChild(createLabeledInput(strings.fields.fontSize, fontSizeInput, () => `${currentSettings.fontSize}px`));

        const bottomInput = document.createElement('input');
        bottomInput.type = 'range';
        bottomInput.min = '2';
        bottomInput.max = '20';
        bottomInput.step = '1';
        bottomInput.value = `${currentSettings.bottom}`;
        bottomInput.addEventListener('input', () => {
            currentSettings.bottom = clamp(Number(bottomInput.value), 2, 20);
            saveSettings();
            applySubtitleStyle();
        });
        appearanceContent.appendChild(createLabeledInput(strings.fields.bottomOffset, bottomInput, () => `${currentSettings.bottom}%`));

        const lineHeightInput = document.createElement('input');
        lineHeightInput.type = 'range';
        lineHeightInput.min = '1.1';
        lineHeightInput.max = '2';
        lineHeightInput.step = '0.05';
        lineHeightInput.value = `${currentSettings.lineHeight}`;
        lineHeightInput.addEventListener('input', () => {
            currentSettings.lineHeight = clamp(Number(lineHeightInput.value), 1.1, 2);
            saveSettings();
            applySubtitleStyle();
        });
        appearanceContent.appendChild(createLabeledInput(strings.fields.lineHeight, lineHeightInput, () => `${currentSettings.lineHeight.toFixed(2)}`));

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = currentSettings.color;
        colorInput.addEventListener('input', () => {
            if (isValidHexColor(colorInput.value)) {
                currentSettings.color = colorInput.value;
                saveSettings();
                applySubtitleStyle();
            }
        });
        const colorLabel = document.createElement('label');
        colorLabel.textContent = strings.fields.fontColor;
        colorLabel.appendChild(colorInput);
        appearanceContent.appendChild(colorLabel);

        const shadowInput = document.createElement('input');
        shadowInput.type = 'color';
        shadowInput.value = currentSettings.shadowColor;
        shadowInput.addEventListener('input', () => {
            if (isValidHexColor(shadowInput.value)) {
                currentSettings.shadowColor = shadowInput.value;
                saveSettings();
                applySubtitleStyle();
            }
        });
        const shadowLabel = document.createElement('label');
        shadowLabel.textContent = strings.fields.shadowColor;
        shadowLabel.appendChild(shadowInput);
        appearanceContent.appendChild(shadowLabel);

        const effectSelect = document.createElement('select');
        ['bar', 'pulse'].forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = strings.buttonEffectOptions[key] || key;
            if (currentSettings.buttonEffect === key) {
                option.selected = true;
            }
            effectSelect.appendChild(option);
        });
        effectSelect.addEventListener('change', () => {
            currentSettings.buttonEffect = effectSelect.value === 'pulse' ? 'pulse' : 'bar';
            saveSettings();
            if (currentSettings.buttonEffect === 'bar') {
                resetSuccessHighlight();
            }
            setLabelState(fileInputLabelRef?.dataset?.state || 'default');
            previewButtonEffect();
        });
        const effectLabel = document.createElement('label');
        effectLabel.textContent = strings.fields.buttonEffect;
        effectLabel.appendChild(effectSelect);
        appearanceContent.appendChild(effectLabel);

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.textContent = strings.reset;
        resetButton.style.cssText = `
            margin-top: 12px;
            width: 100%;
            padding: 10px 0;
            border-radius: 999px;
            border: none;
            font-weight: 600;
            letter-spacing: 0.4px;
            background: linear-gradient(135deg, #ff7b72, #ff4e45);
            color: #fff;
            cursor: pointer;
            transition: transform 0.2s ease, opacity 0.2s ease;
        `;
        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.transform = 'translateY(-1px)';
            resetButton.style.opacity = '0.92';
        });
        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.transform = 'translateY(0)';
            resetButton.style.opacity = '1';
        });
        resetButton.addEventListener('click', () => {
            currentSettings = { ...DEFAULT_SETTINGS };
            saveSettings();
            fontSizeInput.value = `${currentSettings.fontSize}`;
            bottomInput.value = `${currentSettings.bottom}`;
            lineHeightInput.value = `${currentSettings.lineHeight}`;
            colorInput.value = currentSettings.color;
            shadowInput.value = currentSettings.shadowColor;
            effectSelect.value = currentSettings.buttonEffect;
            applySubtitleStyle();
            setLabelState(fileInputLabelRef?.dataset?.state || 'default');
            updateLanguageAwareUI();
        });
        appearanceContent.appendChild(resetButton);

        const languageOptionsContainer = document.createElement('div');
        languageOptionsContainer.className = 'local-subtitle-language-options';
        ['auto', 'zh', 'en'].forEach(value => {
            const optionRow = document.createElement('label');
            optionRow.className = 'local-subtitle-language-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'local-subtitle-language';
            radio.value = value;
            radio.checked = currentSettings.language === value;
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                currentSettings.language = value;
                saveSettings();
                settingsActiveTab = 'language';
                updateLanguageAwareUI();
            });
            const text = document.createElement('span');
            text.textContent = getLanguageOptionLabel(value);
            optionRow.appendChild(radio);
            optionRow.appendChild(text);
            languageOptionsContainer.appendChild(optionRow);
        });
        languageContent.appendChild(languageOptionsContainer);
        const languageNote = document.createElement('p');
        languageNote.className = 'local-subtitle-language-note';
        languageNote.textContent = strings.languageNote;
        languageContent.appendChild(languageNote);

        const driveStrings = getDriveStrings().panel;
        const driveFieldsWrapper = document.createElement('div');
        driveFieldsWrapper.className = 'local-subtitle-drive-fields';
        const driveHelp = document.createElement('p');
        driveHelp.className = 'local-subtitle-drive-note';
        driveHelp.textContent = driveStrings.description;
        driveContent.appendChild(driveHelp);

        const driveFieldConfigs = [
            { key: 'clientId', type: 'text', label: driveStrings.fields.clientId },
            { key: 'clientSecret', type: 'password', label: driveStrings.fields.clientSecret },
            { key: 'refreshToken', type: 'password', label: driveStrings.fields.refreshToken }
        ];

        driveFieldConfigs.forEach(config => {
            const field = document.createElement('label');
            field.className = 'local-subtitle-drive-field';
            const title = document.createElement('span');
            title.textContent = config.label;
            const input = document.createElement('input');
            input.type = config.type;
            input.value = driveSettings[config.key] || '';
            input.dataset.driveField = config.key;
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.addEventListener('input', () => {
                updateDriveSettingValue(config.key, input.value);
            });
            field.appendChild(title);
            field.appendChild(input);
            driveFieldsWrapper.appendChild(field);
        });

        driveContent.appendChild(driveFieldsWrapper);

        const driveHelper = document.createElement('p');
        driveHelper.className = 'local-subtitle-drive-helper';
        driveHelper.textContent = driveStrings.helper;
        driveContent.appendChild(driveHelper);

        const driveActions = document.createElement('div');
        driveActions.className = 'local-subtitle-drive-actions';
        const openPickerButton = document.createElement('button');
        openPickerButton.type = 'button';
        openPickerButton.className = 'local-subtitle-drive-action primary';
        openPickerButton.textContent = driveStrings.actions.openPicker;
        openPickerButton.addEventListener('click', () => {
            toggleSettingsPanel(false);
            openGoogleDriveFilePicker();
        });
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'local-subtitle-drive-action secondary';
        clearButton.textContent = driveStrings.actions.clear;
        clearButton.addEventListener('click', () => {
            clearDriveSettings();
            rebuildSettingsPanelIfOpen();
        });
        driveActions.appendChild(openPickerButton);
        driveActions.appendChild(clearButton);
        driveContent.appendChild(driveActions);

        const autoStrings = strings.automation || {};
        const automationOptions = document.createElement('div');
        automationOptions.className = 'local-subtitle-auto-options';
        [
            {
                key: 'autoDriveLoad',
                label: autoStrings.driveAutoLoad,
                hint: autoStrings.driveHint,
                onToggle: enabled => {
                    currentSettings.autoDriveLoad = enabled;
                    saveSettings();
                    resetDriveAutomationState();
                    if (enabled) {
                        maybeAutoLoadDriveSubtitle();
                    }
                }
            }
        ].forEach(config => {
            const option = document.createElement('div');
            option.className = 'local-subtitle-auto-option';
            const header = document.createElement('div');
            header.className = 'local-subtitle-auto-option-header';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = config.label || config.key;
            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = Boolean(currentSettings[config.key]);
            toggle.addEventListener('change', () => {
                config.onToggle?.(toggle.checked);
            });
            header.appendChild(labelSpan);
            header.appendChild(toggle);
            option.appendChild(header);
            if (config.hint) {
                const hint = document.createElement('small');
                hint.textContent = config.hint;
                option.appendChild(hint);
            }
            automationOptions.appendChild(option);
        });
        automationContent.appendChild(automationOptions);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'local-subtitle-tab-container';
        contentWrapper.appendChild(appearanceContent);
        contentWrapper.appendChild(languageContent);
        contentWrapper.appendChild(driveContent);
        contentWrapper.appendChild(automationContent);
        panel.appendChild(contentWrapper);
        syncSettingsTabs();

        document.body.appendChild(panel);
        settingsPanelRef = panel;
        if (!panelThemeCleanup) {
            panelThemeCleanup = registerThemeListener(applySettingsPanelTheme);
        } else {
            applySettingsPanelTheme();
        }
        return panel;
    }

    function toggleSettingsPanel(force) {
        if (!settingsPanelRef) return;
        const isOpen = settingsPanelRef.style.display !== 'none';
        const next = typeof force === 'boolean' ? force : !isOpen;
        settingsPanelRef.style.display = next ? 'block' : 'none';
    }

    function openSettingsPanel(preferredTab) {
        if (preferredTab) {
            settingsActiveTab = preferredTab;
        }
        const panel = buildSettingsPanel();
        if (!panel) return;
        syncSettingsTabs();
        toggleSettingsPanel(true);
    }

    function registerSettingsMenu() {
        if (settingsMenuRegistered) return;
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand(getLocaleStrings().menuTitle, openSettingsPanel);
        } else {
            console.warn('GM_registerMenuCommand is unavailable; settings panel menu will not be registered.');
        }
        settingsMenuRegistered = true;
    }

    function applyButtonAriaLabels() {
        const label = getLocaleStrings().buttonAria;
        const hasNativeTooltip = Boolean(buttonInteractiveRef);
        if (buttonWrapperRef) {
            const actionButton = buttonWrapperRef.querySelector('button');
            if (actionButton) {
                actionButton.setAttribute('aria-label', label);
                if (hasNativeTooltip) {
                    actionButton.removeAttribute('title');
                } else {
                    actionButton.setAttribute('title', label);
                }
            }
        }
        if (fileInputLabelRef && fileInputLabelRef.tagName === 'LABEL') {
            fileInputLabelRef.setAttribute('aria-label', label);
            if (hasNativeTooltip) {
                fileInputLabelRef.removeAttribute('title');
            } else {
                fileInputLabelRef.setAttribute('title', label);
            }
        }
        updateTooltipLabel(label);
    }

    function rebuildSettingsPanelIfOpen() {
        const wasOpen = settingsPanelRef && settingsPanelRef.style.display !== 'none';
        if (settingsPanelRef) {
            settingsPanelRef.remove();
            settingsPanelRef = null;
        }
        if (wasOpen) {
            buildSettingsPanel();
            toggleSettingsPanel(true);
        }
    }

    function updateLanguageAwareUI() {
        setLabelState(fileInputLabelRef?.dataset?.state || 'default');
        applyButtonAriaLabels();
        destroyDrivePickerOverlay();
        rebuildSettingsPanelIfOpen();
    }

    function syncSettingsTabs() {
        if (!settingsPanelRef) return;
        const activeTab = settingsActiveTab;
        settingsPanelRef.querySelectorAll('[data-tab-button]').forEach(button => {
            const key = button.dataset.tabButton;
            button.classList.toggle('active', key === activeTab);
        });
        settingsPanelRef.querySelectorAll('[data-tab-content]').forEach(content => {
            const key = content.dataset.tabContent;
            if (key === activeTab) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }

    function focusDriveSettingsField(fieldKey = 'clientId') {
        if (!settingsPanelRef) return;
        const target = settingsPanelRef.querySelector(`[data-drive-field="${fieldKey}"]`);
        if (target) {
            target.focus();
            if (typeof target.select === 'function') {
                target.select();
            }
        }
    }
/* -------------------------------------------------------------------------- *
 * Module 04 · Interaction handlers, button states, and inline feedback
 * -------------------------------------------------------------------------- */

    function handleGlobalSettingsClick(event) {
        if (!settingsPanelRef || settingsPanelRef.style.display === 'none') return;
        const target = event.target;
        if (settingsPanelRef.contains(target)) return;
        toggleSettingsPanel(false);
    }

    function cancelEffectPreview() {
        if (effectPreviewTimer) {
            clearTimeout(effectPreviewTimer);
            effectPreviewTimer = null;
        }
        effectPreviewRestoreState = null;
    }

    function previewButtonEffect() {
        if (!fileInputLabelRef || (fileInputLabelRef.dataset.state === 'loading')) return;
        cancelEffectPreview();
        effectPreviewRestoreState = fileInputLabelRef.dataset.state || 'default';
        setLabelState('loading', { fromPreview: true });
        effectPreviewTimer = window.setTimeout(() => {
            if (effectPreviewRestoreState) {
                setLabelState(effectPreviewRestoreState);
            }
            cancelEffectPreview();
        }, 900);
    }

    function scheduleFilePicker(input) {
        pendingFileInputRef = input;
        singleClickTimer = window.setTimeout(() => {
            singleClickTimer = null;
            pendingFileInputRef = null;
            openSettingsPanel();
        }, SINGLE_CLICK_DELAY);
    }

    function cancelScheduledFilePicker() {
        if (singleClickTimer) {
            clearTimeout(singleClickTimer);
            singleClickTimer = null;
        }
        pendingFileInputRef = null;
    }

    function handleSubtitleButtonClick(event, fileInput) {
        event.preventDefault();
        event.stopPropagation();
        if (singleClickTimer) return;
        scheduleFilePicker(fileInput);
    }

    function handleSubtitleButtonDoubleClick(event, fileInput) {
        event.preventDefault();
        event.stopPropagation();
        const target = fileInput || pendingFileInputRef || document.getElementById('local-subtitle-input');
        cancelScheduledFilePicker();
        target?.click();
    }

    function setLabelState(state = 'default', options = {}) {
        if (state === 'loading' && !options.fromPreview) {
            cancelEffectPreview();
        }
        const text = getButtonStateText(state);
        if (fileInputLabelTextRef) {
            fileInputLabelTextRef.textContent = text;
        }
        if (completionBarRef && currentSettings.buttonEffect === 'bar') {
            const active = state === 'loaded';
            completionBarRef.style.opacity = active ? '1' : '0';
            completionBarRef.style.transform = active ? 'scaleX(1)' : 'scaleX(0)';
        } else if (completionBarRef) {
            completionBarRef.style.opacity = '0';
            completionBarRef.style.transform = 'scaleX(0)';
        }
        if (fileInputLabelRef) {
            fileInputLabelRef.dataset.state = state;
        }
        applyButtonEffectSetting(state);
    }

    function ensureInlineMessageElement() {
        if (!fileInputLabelRef) return null;
        if (!inlineMessageRef) {
            const computedStyle = window.getComputedStyle(fileInputLabelRef);
            if (computedStyle.position === 'static') {
                fileInputLabelRef.style.position = 'relative';
            }
            inlineMessageRef = document.createElement('div');
            inlineMessageRef.id = 'local-subtitle-inline-message';
            inlineMessageRef.style.cssText = `
                position: absolute;
                inset: 2px;
                border-radius: inherit;
                padding: 8px 10px;
                border: 1px solid transparent;
                display: none;
                align-items: center;
                justify-content: center;
                text-align: center;
                font-size: 14px;
                font-weight: 600;
                line-height: 1.4;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                z-index: 5;
            `;
            fileInputLabelRef.appendChild(inlineMessageRef);
        }
        return inlineMessageRef;
    }

    function showInlineMessage(message, type = 'info', duration = 5000) {
        if (type === 'success') {
            hideInlineMessage();
            applySuccessHighlight(duration);
            return;
        }

        resetSuccessHighlight();

        const inlineMessage = ensureInlineMessageElement();
        if (!inlineMessage) return;
        const theme = INLINE_MESSAGE_VARIANTS[type] || INLINE_MESSAGE_VARIANTS.info;
        inlineMessage.textContent = message;
        inlineMessage.style.backgroundColor = theme.background;
        inlineMessage.style.color = theme.color;
        inlineMessage.style.borderColor = theme.border;
        inlineMessage.style.display = 'flex';
        requestAnimationFrame(() => {
            inlineMessage.style.opacity = '1';
        });
        if (inlineMessageTimer) {
            clearTimeout(inlineMessageTimer);
            inlineMessageTimer = null;
        }
        inlineMessageTimer = setTimeout(() => {
            hideInlineMessage();
        }, duration);
    }

    function hideInlineMessage() {
        if (!inlineMessageRef) return;
        inlineMessageRef.style.opacity = '0';
        setTimeout(() => {
            if (inlineMessageRef) {
                inlineMessageRef.style.display = 'none';
            }
        }, 200);
        if (inlineMessageTimer) {
            clearTimeout(inlineMessageTimer);
            inlineMessageTimer = null;
        }
    }

    function resetSuccessHighlight() {
        if (successHighlightTimer) {
            clearTimeout(successHighlightTimer);
            successHighlightTimer = null;
        }
        if (!successHighlightOriginalStyle || !fileInputLabelRef) {
            successHighlightOriginalStyle = null;
            return;
        }
        const target = fileInputLabelRef;
        target.style.borderColor = successHighlightOriginalStyle.borderColor;
        successHighlightOriginalStyle = null;
    }

    function applySuccessHighlight(duration = 5000) {
        if (!fileInputLabelRef) return;
        if (currentSettings.buttonEffect === 'bar') {
            resetSuccessHighlight();
            return;
        }
        const target = fileInputLabelRef;
        if (!successHighlightOriginalStyle) {
            successHighlightOriginalStyle = {
                borderColor: target.style.borderColor || ''
            };
        }
        target.style.borderColor = SUCCESS_BORDER_COLOR;
        if (successHighlightTimer) {
            clearTimeout(successHighlightTimer);
        }
        successHighlightTimer = setTimeout(() => {
            resetSuccessHighlight();
        }, duration);
    }
/* -------------------------------------------------------------------------- *
 * Module 05 · Icons, tooltip behavior, and accessibility helpers
 * -------------------------------------------------------------------------- */

    function createSubtitleIcon() {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 512 512');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = `
            margin-right: 0;
            flex: 0 0 auto;
            display: inline-block;
            vertical-align: middle;
        `;
        svg.style.pointerEvents = 'none';

        const pathData = [
            'M472,64H40A24.028,24.028,0,0,0,16,88V424a24.028,24.028,0,0,0,24,24H472a24.028,24.028,0,0,0,24-24V88A24.028,24.028,0,0,0,472,64Zm-8,352H48V96H464Z',
            'M184,344a87.108,87.108,0,0,0,54.484-18.891L218.659,299.99A55.41,55.41,0,0,1,184,312a56,56,0,0,1,0-112,55.41,55.41,0,0,1,34.659,12.01l19.825-25.119A87.108,87.108,0,0,0,184,168a88,88,0,0,0,0,176Z',
            'M347.429,344a87.108,87.108,0,0,0,54.484-18.891L382.088,299.99A55.414,55.414,0,0,1,347.429,312a56,56,0,0,1,0-112,55.414,55.414,0,0,1,34.659,12.01l19.825-25.119A87.108,87.108,0,0,0,347.429,168a88,88,0,0,0,0,176Z'
        ];
        pathData.forEach(d => {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'currentColor');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '16');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);
        });
        return svg;
    }

    function attachIconToLabel(labelElement) {
        if (!labelElement || labelElement.dataset.localSubtitleIcon === 'true') return;
        const parent = labelElement.parentNode;
        if (!parent) return;
        const parentStyle = parent.style || {};
        parentStyle.display = 'inline-flex';
        parentStyle.alignItems = 'center';
        parentStyle.columnGap = '4px';
        parentStyle.lineHeight = '1';
        parent.style.display = parentStyle.display;
        parent.style.alignItems = parentStyle.alignItems;
        parent.style.columnGap = parentStyle.columnGap;
        parent.style.lineHeight = parentStyle.lineHeight;
        labelElement.style.display = 'inline-flex';
        labelElement.style.alignItems = 'center';
        labelElement.style.lineHeight = '1.1';
        labelElement.style.fontSize = '14px';
        labelElement.style.fontWeight = '600';
        const icon = createSubtitleIcon();
        icon.dataset.localSubtitleIcon = 'true';
        parent.insertBefore(icon, labelElement);
        labelElement.dataset.localSubtitleIcon = 'true';
    }

    function ensureNativeTooltipElement() {
        if (tooltipElementRef && document.body.contains(tooltipElementRef)) {
            return tooltipElementRef;
        }
        const tooltip = document.createElement('div');
        tooltip.className = 'local-subtitle-native-tooltip ytPopoverComponentHost ytTooltipContainerDefaultTooltipContent ytPopoverComponentHostSeeThrough';
        tooltip.dataset.visible = 'false';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.textContent = tooltipCurrentText || '';
        document.body.appendChild(tooltip);
        tooltipElementRef = tooltip;
        if (tooltipThemeCleanup) {
            tooltipThemeCleanup();
        }
        tooltipThemeCleanup = registerThemeListener(applyTooltipTheme);
        applyTooltipTheme();
        return tooltip;
    }

    function destroyNativeTooltipElement() {
        if (tooltipShowTimer) {
            clearTimeout(tooltipShowTimer);
            tooltipShowTimer = null;
        }
        if (tooltipHideTimer) {
            clearTimeout(tooltipHideTimer);
            tooltipHideTimer = null;
        }
        tooltipCurrentTarget = null;
        if (tooltipThemeCleanup) {
            tooltipThemeCleanup();
            tooltipThemeCleanup = null;
        }
        if (tooltipElementRef) {
            tooltipElementRef.remove();
            tooltipElementRef = null;
        }
    }

    function updateTooltipLabel(text) {
        tooltipCurrentText = text;
        if (tooltipElementRef) {
            tooltipElementRef.textContent = text;
        }
    }

    function positionNativeTooltip(target) {
        if (!target || !tooltipElementRef) return;
        const rect = target.getBoundingClientRect();
        const tooltip = tooltipElementRef;
        const targetCenter = rect.left + (rect.width / 2);
        const viewportWidth = document.documentElement.clientWidth;
        tooltip.style.top = `${rect.bottom + TOOLTIP_VERTICAL_GAP}px`;
        const tooltipWidth = tooltip.offsetWidth || 0;
        const minLeft = 12;
        const maxLeft = viewportWidth - tooltipWidth - 12;
        let left = targetCenter - (tooltipWidth / 2);
        if (left < minLeft) {
            left = minLeft;
        } else if (left > maxLeft) {
            left = maxLeft;
        }
        tooltip.style.left = `${Math.max(minLeft, Math.min(left, maxLeft))}px`;
    }

    function showNativeTooltip(target) {
        if (!target) return;
        tooltipCurrentTarget = target;
        const tooltip = ensureNativeTooltipElement();
        tooltip.textContent = tooltipCurrentText;
        tooltip.dataset.visible = 'false';
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.style.left = '-9999px';
        tooltip.style.top = '-9999px';
        requestAnimationFrame(() => {
            positionNativeTooltip(target);
            tooltip.dataset.visible = 'true';
            tooltip.setAttribute('aria-hidden', 'false');
        });
    }

    function hideNativeTooltip() {
        tooltipCurrentTarget = null;
        if (!tooltipElementRef) return;
        tooltipElementRef.dataset.visible = 'false';
        tooltipElementRef.setAttribute('aria-hidden', 'true');
    }

    function scheduleTooltip(target, visible) {
        if (visible) {
            if (tooltipHideTimer) {
                clearTimeout(tooltipHideTimer);
                tooltipHideTimer = null;
            }
            if (tooltipShowTimer) {
                clearTimeout(tooltipShowTimer);
            }
            tooltipShowTimer = window.setTimeout(() => {
                tooltipShowTimer = null;
                showNativeTooltip(target);
            }, TOOLTIP_SHOW_DELAY);
        } else {
            if (tooltipShowTimer) {
                clearTimeout(tooltipShowTimer);
                tooltipShowTimer = null;
            }
            if (tooltipHideTimer) {
                clearTimeout(tooltipHideTimer);
            }
            tooltipHideTimer = window.setTimeout(() => {
                tooltipHideTimer = null;
                hideNativeTooltip();
            }, TOOLTIP_HIDE_DELAY);
        }
    }

    function attachNativeTooltip(target) {
        if (buttonTooltipCleanup) {
            buttonTooltipCleanup();
            buttonTooltipCleanup = null;
        }
        buttonInteractiveRef = target || null;
        if (!target) {
            hideNativeTooltip();
        }
        if (!target) return;
        const showHandler = () => {
            if (isMobileDevice()) return;
            scheduleTooltip(target, true);
        };
        const hideHandler = () => scheduleTooltip(target, false);
        target.addEventListener('mouseenter', showHandler);
        target.addEventListener('mouseleave', hideHandler);
        target.addEventListener('focus', showHandler);
        target.addEventListener('blur', hideHandler);
        target.addEventListener('touchstart', showHandler, { passive: true });
        target.addEventListener('touchend', hideHandler, { passive: true });
        buttonTooltipCleanup = () => {
            target.removeEventListener('mouseenter', showHandler);
            target.removeEventListener('mouseleave', hideHandler);
            target.removeEventListener('focus', showHandler);
            target.removeEventListener('blur', hideHandler);
            target.removeEventListener('touchstart', showHandler);
            target.removeEventListener('touchend', hideHandler);
            if (tooltipCurrentTarget === target) {
                hideNativeTooltip();
            }
        };
    }


    // 检测是否为移动设备或移动浏览器
/* -------------------------------------------------------------------------- *
 * Module 06 · Subtitle detection, parsing, and rendering loop
 * -------------------------------------------------------------------------- */

    function isMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
        const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        return isMobileUA || isTouchDevice || isSmallScreen;
    }

    // 验证文件是否为字幕文件
    function isSubtitleFile(file) {
        if (!file) return false;
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.srt', '.vtt'];
        return validExtensions.some(ext => fileName.endsWith(ext));
    }

    function hasLoadedSubtitles() {
        return Array.isArray(subtitles) && subtitles.length > 0;
    }

    // 将时间字符串 (HH:MM:SS,ms 或 MM:SS,ms) 转换为秒
    function timeToSeconds(timeString) {
        const parts = timeString.replace('.', ',').split(/[:,]/).reverse();
        if (parts.length < 3) return 0;
        const milliseconds = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        const minutes = parseInt(parts[2], 10) || 0;
        const hours = parseInt(parts[3], 10) || 0;
        return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
    }

    // 解析 SRT/VTT 字幕内容
    function parseSubtitles(subtitleContent) {
        const lines = subtitleContent.replace(/\r/g, '').split('\n\n');
        const subs = [];
        for (const line of lines) {
            const parts = line.split('\n');
            if (parts.length < 2) continue;
            const timeMatch = parts.find(p => p.includes('-->'));
            if (!timeMatch) continue;
            const timeParts = timeMatch.split(' --> ');
            if (timeParts.length !== 2) continue;
            const startTime = timeToSeconds(timeParts[0]);
            const endTime = timeToSeconds(timeParts[1]);
            const text = parts.slice(parts.indexOf(timeMatch) + 1).join('\n').trim();
            if (text) {
                subs.push({ start: startTime, end: endTime, text: text });
            }
        }
        return subs;
    }

    function renderSubtitleText(text) {
        if (!subtitleContainer) return;
        subtitleContainer.replaceChildren();
        const fragments = text.split('\n');
        fragments.forEach((fragment, index) => {
            if (index > 0) {
                subtitleContainer.appendChild(document.createElement('br'));
            }
            subtitleContainer.appendChild(document.createTextNode(fragment));
        });
        lastSubtitleText = text;
    }

    // 更新字幕显示
    function updateSubtitles() {
        if (!videoElement || !subtitleContainer) {
            animationFrameId = requestAnimationFrame(updateSubtitles);
            return;
        }
        const currentTime = videoElement.currentTime;
        const currentSub = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
        if (currentSub && lastSubtitleText !== currentSub.text) {
            renderSubtitleText(currentSub.text);
            subtitleContainer.style.visibility = 'visible';
        } else if (!currentSub && lastSubtitleText !== '') {
            subtitleContainer.replaceChildren();
            lastSubtitleText = '';
            subtitleContainer.style.visibility = 'hidden';
        }
        animationFrameId = requestAnimationFrame(updateSubtitles);
    }

    // 检测YouTube或系统是否为深色模式
/* -------------------------------------------------------------------------- *
 * Module 07 · Theme detection utilities and palette application
 * -------------------------------------------------------------------------- */

    function detectDarkMode() {
        const darkAttr = document.documentElement.getAttribute('dark');
        const youtubeDark = darkAttr && darkAttr !== 'false';
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return youtubeDark || systemDark;
    }

    function getYouTubeChipColors(isDarkMode) {
        const root = document.documentElement;
        const styles = window.getComputedStyle(root);
        const candidates = [
            '--yt-spec-badge-chip-background',
            '--yt-spec-10-percent-layer',
            '--yt-spec-static-overlay-background-light'
        ];
        let bg = '';
        for (const key of candidates) {
            const val = styles.getPropertyValue(key)?.trim();
            if (val) {
                bg = val;
                break;
            }
        }
        if (!bg) {
            bg = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f1f1';
        }
        const border = 'transparent';
        return { bg, border };
    }

    function applySettingsPanelTheme() {
        if (!settingsPanelRef) return;
        const isDarkMode = detectDarkMode();
        const palette = isDarkMode
            ? {
                bg: 'rgba(32, 33, 36, 0.95)',
                text: '#ffffff',
                border: 'rgba(255,255,255,0.14)',
                fieldBg: 'rgba(255,255,255,0.08)',
                fieldBorder: 'rgba(255,255,255,0.2)',
                fieldBorderStrong: 'rgba(255,255,255,0.45)',
                fieldActiveBg: 'rgba(255,255,255,0.18)',
                subtext: 'rgba(255,255,255,0.7)'
            }
            : {
                bg: 'rgba(255,255,255,0.98)',
                text: '#0f0f0f',
                border: 'rgba(0,0,0,0.12)',
                fieldBg: 'rgba(0,0,0,0.04)',
                fieldBorder: 'rgba(0,0,0,0.12)',
                fieldBorderStrong: 'rgba(0,0,0,0.24)',
                fieldActiveBg: 'rgba(0,0,0,0.08)',
                subtext: 'rgba(15,15,15,0.65)'
            };
        const style = settingsPanelRef.style;
        style.setProperty('--local-subtitle-panel-bg', palette.bg);
        style.setProperty('--local-subtitle-panel-text', palette.text);
        style.setProperty('--local-subtitle-panel-border', palette.border);
        style.setProperty('--local-subtitle-panel-field-bg', palette.fieldBg);
        style.setProperty('--local-subtitle-panel-field-border', palette.fieldBorder);
        style.setProperty('--local-subtitle-panel-field-border-strong', palette.fieldBorderStrong);
        style.setProperty('--local-subtitle-panel-field-active-bg', palette.fieldActiveBg);
        style.setProperty('--local-subtitle-panel-subtext', palette.subtext);
    }

    function applyTooltipTheme() {
        if (!tooltipElementRef) return;
        const rootStyles = window.getComputedStyle(document.documentElement);
        const resolveVar = name => (rootStyles.getPropertyValue(name) || '').trim();
        const isDarkMode = detectDarkMode();
        const palette = isDarkMode
            ? {
                bg: '#383838',
                text: '#ffffff',
                border: 'rgba(255, 255, 255, 0.14)',
                shadow: '0 10px 26px rgba(0, 0, 0, 0.45)'
            }
            : {
                bg: '#606060',
                text: '#ffffff',
                border: 'rgba(0, 0, 0, 0.2)',
                shadow: '0 10px 26px rgba(0, 0, 0, 0.2)'
            };
        const style = tooltipElementRef.style;
        style.setProperty('--local-subtitle-tooltip-bg', resolveVar('--yt-spec-static-overlay-background-medium')
            || resolveVar('--yt-spec-tooltip-background')
            || palette.bg);
        style.setProperty('--local-subtitle-tooltip-text', resolveVar('--yt-spec-static-overlay-text-primary')
            || resolveVar('--yt-spec-text-primary')
            || palette.text);
        style.setProperty('--local-subtitle-tooltip-border', resolveVar('--yt-spec-outline-3')
            || resolveVar('--yt-spec-10-percent-layer')
            || resolveVar('--yt-spec-static-overlay-background-light')
            || palette.border);
        style.setProperty('--local-subtitle-tooltip-shadow', palette.shadow);
    }

/* -------------------------------------------------------------------------- *
 * Module 08 · File processing, UI assembly, and event wiring on YouTube
 * -------------------------------------------------------------------------- */


    function applySubtitleText(content) {
        if (typeof content !== 'string' || !content.trim()) {
            showInlineMessage(getLocalizedMessage('parseFailed'), 'error');
            setLabelState('default');
            return false;
        }
        subtitles = parseSubtitles(content);
        if (subtitles.length > 0) {
            showInlineMessage(getLocalizedMessage('parseSuccess', subtitles.length), 'success');
            setLabelState('loaded');
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            updateSubtitles();
            return true;
        }
        showInlineMessage(getLocalizedMessage('parseFailed'), 'error');
        setLabelState('default');
        return false;
    }

    // 处理文件选择
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
            return;
        }
        setLabelState('loading');
        if (!isSubtitleFile(file)) {
            showInlineMessage(getLocalizedMessage('invalidFile'), 'error');
            event.target.value = '';
            setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            applySubtitleText(content);
        };
        reader.onerror = function() {
            showInlineMessage(getLocalizedMessage('readError'), 'error');
            setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
        };
        reader.readAsText(file, 'UTF-8');
    }

    // 创建并注入UI元素
    function injectUI() {
        const player = document.querySelector('#movie_player');
        const actionsContainer = document.querySelector('#below #actions');
        if (!player || !actionsContainer) return;
        ensureExtraStyles();
        const ariaLabelText = getLocaleStrings().buttonAria;

        // --- 创建字幕显示容器 ---
        subtitleContainer = document.createElement('div');
        subtitleContainer.id = 'custom-subtitle-display';
        subtitleContainer.style.visibility = 'hidden';
        player.appendChild(subtitleContainer);
        applySubtitleStyle();

        // --- 创建文件选择器 ---
        const container = document.createElement('div');
        container.id = 'local-subtitle-input-container';
        container.style.cssText = `display: flex; align-items: center; margin: 0 8px; gap: 8px; position: relative;`;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        if (!isMobileDevice()) {
            fileInput.accept = '.srt,.vtt,text/plain,text/vtt';
        }
        fileInput.style.display = 'none';
        fileInput.id = 'local-subtitle-input';
        fileInput.addEventListener('change', handleFileSelect);

        const shareButton = actionsContainer.querySelector('ytd-button-renderer:nth-child(2)');
        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.cssText = 'position: relative; display: inline-flex;';
        buttonWrapper.classList.add('local-subtitle-button-wrapper');
        buttonWrapperRef = buttonWrapper;
        buttonInteractiveRef = null;

        let labelSpan = null;
        let applyLabelTheme = null;
        let interactiveTarget = null;

        if (shareButton) {
            const clonedRenderer = shareButton.cloneNode(true);
            clonedRenderer.removeAttribute('id');
            clonedRenderer.style.marginLeft = '8px';
            clonedRenderer.querySelectorAll('yt-icon, yt-icon-shape, .yt-spec-button-shape-next__icon').forEach(icon => {
                icon.remove();
            });
            const clonedButton = clonedRenderer.querySelector('button');
            if (clonedButton) {
                clonedButton.type = 'button';
                clonedButton.removeAttribute('href');
                clonedButton.onclick = null;
                clonedButton.addEventListener('click', event => handleSubtitleButtonClick(event, fileInput));
                clonedButton.addEventListener('dblclick', event => handleSubtitleButtonDoubleClick(event, fileInput));
                clonedButton.setAttribute('aria-label', ariaLabelText);
                clonedButton.style.paddingLeft = '12px';
                attachLongPressListeners(clonedButton);
                interactiveTarget = clonedButton;
            }
            labelSpan = clonedRenderer.querySelector('yt-formatted-string') || clonedRenderer.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = getButtonStateText('default');
                attachIconToLabel(labelSpan);
            }
            buttonWrapper.appendChild(clonedRenderer);
            fileInputLabelRef = buttonWrapper;
        } else {
            const fileInputLabel = document.createElement('label');
            fileInputLabel.htmlFor = 'local-subtitle-input';
            fileInputLabel.style.cssText = `
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 16px 0 12px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: .2px;
                min-height: 36px;
                min-width: 96px;
                transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                white-space: nowrap;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
                position: relative;
                box-sizing: border-box;
                border: 1px solid transparent;
            `;

            labelSpan = document.createElement('span');
            labelSpan.textContent = getButtonStateText('default');
            labelSpan.style.cssText = 'pointer-events: none;';
            fileInputLabel.appendChild(labelSpan);
            attachIconToLabel(labelSpan);
            buttonWrapper.appendChild(fileInputLabel);
            fileInputLabelRef = fileInputLabel;
            fileInputLabel.addEventListener('click', event => handleSubtitleButtonClick(event, fileInput));
            fileInputLabel.addEventListener('dblclick', event => handleSubtitleButtonDoubleClick(event, fileInput));
            fileInputLabel.setAttribute('aria-label', ariaLabelText);
            interactiveTarget = fileInputLabel;

            applyLabelTheme = () => {
                const isDarkMode = detectDarkMode();
                const { bg, border } = getYouTubeChipColors(isDarkMode);
                const textColor = isDarkMode ? '#f1f1f1' : '#0f0f0f';
                fileInputLabel.style.backgroundColor = bg;
                fileInputLabel.style.color = textColor;
                if (successHighlightTimer && successHighlightOriginalStyle) {
                    successHighlightOriginalStyle.borderColor = border;
                } else {
                    fileInputLabel.style.borderColor = border;
                }
            };

            const applyHoverTheme = () => {
                const isDarkMode = detectDarkMode();
                fileInputLabel.style.backgroundColor = isDarkMode ? '#343434' : '#e5e5e5';
            };

            fileInputLabel.onmouseover = applyHoverTheme;
            fileInputLabel.onmouseout = applyLabelTheme;
            fileInputLabel.ontouchstart = applyHoverTheme;
            fileInputLabel.ontouchend = () => setTimeout(applyLabelTheme, 150);
        }

        const completionBar = document.createElement('div');
        completionBar.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            bottom: -10px;
            height: 2px;
            border-radius: 999px;
            background: #ff4e45;
            opacity: 0;
            transform: scaleX(0);
            transform-origin: left center;
            transition: opacity 0.25s ease, transform 0.25s ease;
            pointer-events: none;
        `;

        buttonWrapper.appendChild(completionBar);

        fileInputLabelTextRef = labelSpan;
        completionBarRef = completionBar;
        attachNativeTooltip(interactiveTarget);
        setLabelState('default');
        applyButtonAriaLabels();

        if (applyLabelTheme) {
            if (labelThemeCleanup) {
                labelThemeCleanup();
                labelThemeCleanup = null;
            }
            labelThemeCleanup = registerThemeListener(applyLabelTheme);
        }

        container.appendChild(fileInput);
        container.appendChild(buttonWrapper);

        if (shareButton) {
            shareButton.parentNode.insertBefore(container, shareButton.nextSibling);
        } else {
            actionsContainer.appendChild(container);
        }

        videoElement = document.querySelector('#movie_player video');
        if (!videoElement) {
            console.error("Could not find video element.");
            return;
        }

        uiInjected = true;
        console.log('Subtitle UI injected.');

        if (!animationFrameId) {
            updateSubtitles();
        }

        maybeAutoLoadDriveSubtitle();
    }

    // 清理函数：移除UI，重置状态
/* -------------------------------------------------------------------------- *
 * Module 09 · Google Drive integration (OAuth token flow + file picker)
 * -------------------------------------------------------------------------- */

    const DRIVE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const DRIVE_FILE_PAGE_SIZE = 50;
    const DRIVE_FILE_FIELDS = 'files(id,name,mimeType,modifiedTime)';
    let drivePickerOverlayRef = null;
    let drivePickerListRef = null;
    let drivePickerStatusRef = null;
    let drivePickerKeydownHandler = null;
    let driveListingInProgress = false;
    let driveVideoTitleCache = {
        url: '',
        value: '',
        promise: null
    };
    let autoDriveAttemptedForVideo = '';

    function notifyDriveUser(message, type = 'info') {
        if (fileInputLabelRef) {
            showInlineMessage(message, type);
            return;
        }
        try {
            if (type === 'error') {
                alert(message);
            } else {
                console.log('[Drive]', message);
            }
        } catch {
            console.log('[Drive]', message);
        }
    }

    function resetDriveTokenCache() {
        driveAccessToken = null;
        driveAccessTokenExpireAt = 0;
    }

    function resetDriveVideoTitleCache() {
        driveVideoTitleCache = {
            url: '',
            value: '',
            promise: null
        };
    }

    function resetDriveAutomationState() {
        autoDriveAttemptedForVideo = '';
    }

    function ensureDriveApiAvailable() {
        if (typeof GM_xmlhttpRequest !== 'function') {
            notifyDriveUser(getDriveStrings().messages.gmUnavailable, 'error');
            return false;
        }
        return true;
    }

    function hasDriveCredentials() {
        return Boolean(
            driveSettings.clientId &&
            driveSettings.clientSecret &&
            driveSettings.refreshToken
        );
    }

    function getCanonicalVideoUrl() {
        try {
            const current = new URL(window.location.href);
            if (!current.hostname.includes('youtube.com')) {
                return window.location.href;
            }
            let videoId = current.searchParams.get('v') || '';
            if (!videoId && current.pathname.startsWith('/shorts/')) {
                const segments = current.pathname.split('/').filter(Boolean);
                videoId = segments[1] || segments[0] || '';
            }
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
            return current.origin + current.pathname + current.search;
        } catch (error) {
            console.warn('Failed to derive canonical video URL:', error);
            return window.location.href;
        }
    }

    function fallbackDocumentVideoTitle() {
        const inlineTitle = document.querySelector('#title h1 yt-formatted-string')?.textContent;
        const docTitle = inlineTitle || document.title || '';
        return docTitle.replace(/ - YouTube$/i, '').trim();
    }

    function fetchVideoTitleViaOEmbed(videoUrl) {
        return new Promise((resolve, reject) => {
            if (!videoUrl) {
                reject(new Error('Missing video URL for oEmbed lookup.'));
                return;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`,
                headers: {
                    Accept: 'application/json'
                },
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText || '{}');
                            if (data?.title) {
                                resolve(String(data.title));
                            } else {
                                reject(new Error('oEmbed payload missing title.'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(
                            new Error(
                                `oEmbed HTTP ${response.status}: ${response.responseText || ''}`
                            )
                        );
                    }
                },
                onerror: err => {
                    reject(new Error(`oEmbed network error: ${JSON.stringify(err)}`));
                }
            });
        });
    }

    async function getActiveVideoTitle() {
        const canonicalUrl = getCanonicalVideoUrl();
        const cacheKey = canonicalUrl || window.location.href;
        if (driveVideoTitleCache.value && driveVideoTitleCache.url === cacheKey) {
            return driveVideoTitleCache.value;
        }
        if (driveVideoTitleCache.promise && driveVideoTitleCache.url === cacheKey) {
            return driveVideoTitleCache.promise;
        }
        const promise = (async () => {
            try {
                const title = await fetchVideoTitleViaOEmbed(canonicalUrl);
                if (title) {
                    return title;
                }
            } catch (error) {
                console.warn('Drive oEmbed lookup failed, falling back to document title.', error);
            }
            const fallback = fallbackDocumentVideoTitle();
            return fallback || canonicalUrl;
        })();
        driveVideoTitleCache = {
            url: cacheKey,
            value: '',
            promise
        };
        const resolved = await promise;
        driveVideoTitleCache.value = resolved;
        driveVideoTitleCache.promise = null;
        return resolved;
    }

    function promptDriveCredentials() {
        openSettingsPanel('drive');
        requestAnimationFrame(() => {
            focusDriveSettingsField('clientId');
        });
    }

    function ensureDrivePreconditions() {
        const strings = getDriveStrings();
        if (!ensureDriveApiAvailable()) {
            return false;
        }
        if (!hasDriveCredentials()) {
            notifyDriveUser(strings.messages.missingConfig, 'error');
            return false;
        }
        return true;
    }

    function refreshDriveAccessToken() {
        return new Promise((resolve, reject) => {
            const body = [
                ['client_id', driveSettings.clientId],
                ['client_secret', driveSettings.clientSecret],
                ['refresh_token', driveSettings.refreshToken],
                ['grant_type', 'refresh_token']
            ]
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value || ''))}`)
                .join('&');
            GM_xmlhttpRequest({
                method: 'POST',
                url: DRIVE_TOKEN_ENDPOINT,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: body,
                onload: response => {
                    const text = response.responseText || '';
                    try {
                        const json = text ? JSON.parse(text) : {};
                        if (response.status >= 200 && response.status < 300) {
                            if (json.error) {
                                reject(new Error(`Drive token error: ${JSON.stringify(json)}`));
                            } else {
                                resolve(json);
                            }
                        } else {
                            reject(
                                new Error(
                                    `Drive token HTTP ${response.status}: ${text || '[empty response]'}`
                                )
                            );
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: err => {
                    reject(new Error(`Drive token request failed: ${JSON.stringify(err)}`));
                }
            });
        });
    }

    async function ensureDriveAccessToken() {
        const now = Date.now();
        if (driveAccessToken && now < driveAccessTokenExpireAt - 60000) {
            return driveAccessToken;
        }
        const tokenPayload = await refreshDriveAccessToken();
        driveAccessToken = tokenPayload.access_token;
        const expiresIn = Number(tokenPayload.expires_in) || 3600;
        driveAccessTokenExpireAt = now + expiresIn * 1000;
        return driveAccessToken;
    }

    function listDriveFiles(token) {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                pageSize: String(DRIVE_FILE_PAGE_SIZE),
                fields: DRIVE_FILE_FIELDS,
                orderBy: 'modifiedTime desc'
            });
            const nameFilters = [
                "name contains '.srt'",
                "name contains '.SRT'",
                "name contains '.vtt'",
                "name contains '.VTT'"
            ];
            params.set('q', `(trashed = false) and (${nameFilters.join(' or ')})`);
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${DRIVE_FILES_ENDPOINT}?${params.toString()}`,
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                },
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText || '{}');
                            resolve(Array.isArray(data.files) ? data.files : []);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(
                            new Error(
                                `Drive list HTTP ${response.status}: ${response.responseText || ''}`
                            )
                        );
                    }
                },
                onerror: err => {
                    reject(new Error(`Drive list network error: ${JSON.stringify(err)}`));
                }
            });
        });
    }

    function buildDriveError(status, text, defaultMessage) {
        let parsed;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = null;
        }
        const err = new Error(
            parsed?.error?.message
                ? `Drive download HTTP ${status}: ${parsed.error.message}`
                : defaultMessage
        );
        err.driveStatus = status;
        err.driveReason =
            parsed?.error?.errors?.[0]?.reason ||
            parsed?.error?.status ||
            parsed?.error?.code ||
            '';
        return err;
    }

    function downloadDriveFileContent(fileId, token) {
        return new Promise((resolve, reject) => {
            const encoded = encodeURIComponent(fileId);
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${DRIVE_FILES_ENDPOINT}/${encoded}?alt=media`,
                headers: {
                    Authorization: `Bearer ${token}`
                },
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText || '');
                    } else {
                        reject(
                            buildDriveError(
                                response.status,
                                response.responseText,
                                `Drive download HTTP ${response.status}: ${response.responseText || ''}`
                            )
                        );
                    }
                },
                onerror: err => {
                    reject(new Error(`Drive download network error: ${JSON.stringify(err)}`));
                }
            });
        });
    }

    function isDriveSubtitleFileName(name) {
        return typeof name === 'string' && /\.(srt|vtt)$/i.test(name.trim());
    }

    function stripSubtitleExtension(name = '') {
        return name.replace(/\.(srt|vtt)$/i, '');
    }

    function normalizeForSimilarity(value) {
        if (!value) return '';
        let normalized = value;
        if (typeof normalized.normalize === 'function') {
            normalized = normalized.normalize('NFKC');
        }
        return normalized
            .toLowerCase()
            .replace(/[^0-9a-z\u00c0-\u02ff\u0370-\u052f\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\s]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function computeCharacterOverlap(a, b) {
        const cleanA = normalizeForSimilarity(a).replace(/\s+/g, '');
        const cleanB = normalizeForSimilarity(b).replace(/\s+/g, '');
        if (!cleanA || !cleanB) return 0;
        if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
            return Math.min(cleanA.length, cleanB.length) / Math.max(cleanA.length, cleanB.length);
        }
        const shorter = cleanA.length <= cleanB.length ? cleanA : cleanB;
        const longer = cleanA.length > cleanB.length ? cleanA : cleanB;
        const freq = new Map();
        for (const char of shorter) {
            freq.set(char, (freq.get(char) || 0) + 1);
        }
        let matches = 0;
        for (const char of longer) {
            const current = freq.get(char);
            if (current) {
                matches += 1;
                if (current === 1) {
                    freq.delete(char);
                } else {
                    freq.set(char, current - 1);
                }
            }
        }
        return matches / Math.max(longer.length, 1);
    }

    function computeDriveFileSimilarity(fileName, targetTitle) {
        const normalizedFile = normalizeForSimilarity(stripSubtitleExtension(fileName || ''));
        const normalizedTitle = normalizeForSimilarity(targetTitle || '');
        if (!normalizedFile || !normalizedTitle) {
            return 0;
        }
        if (normalizedFile === normalizedTitle) {
            return 1;
        }
        const tokensFile = normalizedFile.split(' ').filter(Boolean);
        const tokensTitle = normalizedTitle.split(' ').filter(Boolean);
        const setFile = new Set(tokensFile);
        const setTitle = new Set(tokensTitle);
        let intersections = 0;
        setFile.forEach(token => {
            if (setTitle.has(token)) {
                intersections += 1;
            }
        });
        const union = setFile.size + setTitle.size - intersections;
        const jaccard = union > 0 ? intersections / union : 0;
        const coverage = setTitle.size > 0 ? intersections / setTitle.size : 0;
        const charOverlap = computeCharacterOverlap(normalizedFile, normalizedTitle);
        return Math.max(jaccard, coverage, charOverlap);
    }

    function ensureDrivePickerOverlay() {
        if (drivePickerOverlayRef && document.body.contains(drivePickerOverlayRef)) {
            updateDrivePickerLocalization();
            return drivePickerOverlayRef;
        }
        ensureExtraStyles();
        const overlay = document.createElement('div');
        overlay.className = 'local-subtitle-drive-backdrop';
        overlay.dataset.visible = 'false';
        overlay.addEventListener('click', event => {
            if (event.target === overlay) {
                hideDrivePickerOverlay();
            }
        });
        const panel = document.createElement('div');
        panel.className = 'local-subtitle-drive-panel';
        const header = document.createElement('div');
        header.className = 'local-subtitle-drive-panel-header';
        const title = document.createElement('h5');
        title.dataset.drivePickerTitle = 'true';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.dataset.drivePickerClose = 'true';
        closeBtn.className = 'local-subtitle-drive-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', hideDrivePickerOverlay);
        header.appendChild(title);
        header.appendChild(closeBtn);
        const status = document.createElement('div');
        status.className = 'local-subtitle-drive-status';
        const list = document.createElement('div');
        list.className = 'local-subtitle-drive-list';
        panel.appendChild(header);
        panel.appendChild(status);
        panel.appendChild(list);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        drivePickerOverlayRef = overlay;
        drivePickerListRef = list;
        drivePickerStatusRef = status;
        updateDrivePickerLocalization();
        return overlay;
    }

    function updateDrivePickerLocalization() {
        if (!drivePickerOverlayRef) return;
        const strings = getDriveStrings().picker;
        const title = drivePickerOverlayRef.querySelector('[data-drive-picker-title]');
        if (title) {
            title.textContent = strings.title;
        }
        const closeBtn = drivePickerOverlayRef.querySelector('[data-drive-picker-close]');
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', strings.close);
            closeBtn.title = strings.close;
        }
    }

    function showDrivePickerOverlay() {
        const overlay = ensureDrivePickerOverlay();
        overlay.dataset.visible = 'true';
        updateDrivePickerLocalization();
        if (!drivePickerKeydownHandler) {
            drivePickerKeydownHandler = event => {
                if (event.key === 'Escape') {
                    hideDrivePickerOverlay();
                }
            };
            document.addEventListener('keydown', drivePickerKeydownHandler);
        }
    }

    function hideDrivePickerOverlay() {
        if (!drivePickerOverlayRef) return;
        drivePickerOverlayRef.dataset.visible = 'false';
        if (drivePickerKeydownHandler) {
            document.removeEventListener('keydown', drivePickerKeydownHandler);
            drivePickerKeydownHandler = null;
        }
    }

    function destroyDrivePickerOverlay() {
        hideDrivePickerOverlay();
        driveListingInProgress = false;
        driveSelectionInProgress = false;
        if (drivePickerOverlayRef) {
            drivePickerOverlayRef.remove();
            drivePickerOverlayRef = null;
            drivePickerListRef = null;
            drivePickerStatusRef = null;
        }
    }

    function setDrivePickerStatus(type, text) {
        if (!drivePickerStatusRef) return;
        drivePickerStatusRef.replaceChildren();
        if (text) {
            const span = document.createElement('span');
            span.textContent = text;
            drivePickerStatusRef.appendChild(span);
        }
        if (type === 'error') {
            const retryButton = document.createElement('button');
            retryButton.type = 'button';
            retryButton.className = 'local-subtitle-drive-status-action';
            retryButton.textContent = getDriveStrings().picker.retry;
            retryButton.addEventListener('click', () => {
                loadDrivePickerFileList();
            });
            drivePickerStatusRef.appendChild(retryButton);
        }
    }

    function renderDrivePickerFiles(files) {
        const pickerStrings = getDriveStrings().picker;
        if (!drivePickerListRef) return;
        drivePickerListRef.replaceChildren();
        if (!Array.isArray(files) || files.length === 0) {
            setDrivePickerStatus('empty', pickerStrings.empty);
            return;
        }
        files.forEach(file => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'local-subtitle-drive-file';
            button.addEventListener('click', () => {
                handleDrivePickerFileClick(file);
            });
            const name = document.createElement('span');
            name.className = 'local-subtitle-drive-file-name';
            name.textContent = file.name || 'Untitled';
            const meta = document.createElement('span');
            meta.className = 'local-subtitle-drive-file-meta';
            const parts = [];
            if (typeof file.similarity === 'number' && file.similarity > 0) {
                parts.push(`${pickerStrings.matchPrefix} ${Math.round(file.similarity * 100)}%`);
            }
            if (file.modifiedTime) {
                try {
                    parts.push(new Date(file.modifiedTime).toLocaleString());
                } catch {
                    parts.push(file.modifiedTime);
                }
            }
            if (file.mimeType) {
                parts.push(file.mimeType);
            }
            meta.textContent = parts.join(' · ');
            button.appendChild(name);
            button.appendChild(meta);
            drivePickerListRef.appendChild(button);
        });
        setDrivePickerStatus('hint', pickerStrings.hint);
    }

    async function fetchDriveSubtitleFileList() {
        const token = await ensureDriveAccessToken();
        const allFiles = await listDriveFiles(token);
        const videoTitle = await getActiveVideoTitle();
        const subtitleFiles = allFiles
            .filter(file => isDriveSubtitleFileName(file?.name))
            .map(file => ({
                ...file,
                similarity: computeDriveFileSimilarity(file?.name, videoTitle)
            }))
            .sort((a, b) => {
                if (typeof b.similarity === 'number' && typeof a.similarity === 'number') {
                    if (b.similarity !== a.similarity) {
                        return b.similarity - a.similarity;
                    }
                }
                if (a.modifiedTime && b.modifiedTime) {
                    const delta = new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
                    if (delta !== 0) {
                        return delta;
                    }
                }
                return (a.name || '').localeCompare(b.name || '');
            });
        return { files: subtitleFiles, token };
    }

    async function loadDrivePickerFileList() {
        if (driveListingInProgress) return;
        driveListingInProgress = true;
        const pickerStrings = getDriveStrings().picker;
        setDrivePickerStatus('loading', pickerStrings.loading);
        if (drivePickerListRef) {
            drivePickerListRef.replaceChildren();
        }
        try {
            const { files } = await fetchDriveSubtitleFileList();
            renderDrivePickerFiles(files);
        } catch (error) {
            console.error('Google Drive list error:', error);
            setDrivePickerStatus('error', pickerStrings.error);
        } finally {
            driveListingInProgress = false;
        }
    }

    async function handleDrivePickerFileClick(file) {
        if (!file || driveSelectionInProgress) {
            return;
        }
        driveSelectionInProgress = true;
        const strings = getDriveStrings();
        setDrivePickerStatus('loading', strings.picker.loadingFile(file.name || file.id));
        try {
            setLabelState('loading');
            const token = await ensureDriveAccessToken();
            const content = await downloadDriveFileContent(file.id, token);
            if (!content) {
                throw new Error('Empty Drive file response.');
            }
            const success = applySubtitleText(content);
            if (success) {
                hideDrivePickerOverlay();
            } else {
                setDrivePickerStatus('error', strings.messages.parseFailed);
            }
        } catch (error) {
            console.error('Google Drive download error:', error);
            if (error?.driveReason === 'appNotAuthorizedToFile') {
                setDrivePickerStatus('error', strings.messages.permissionDenied);
            } else {
                setDrivePickerStatus('error', strings.messages.downloadFailed);
            }
            setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
        } finally {
            driveSelectionInProgress = false;
        }
    }

    async function maybeAutoLoadDriveSubtitle() {
        if (!currentSettings.autoDriveLoad) return;
        if (hasLoadedSubtitles()) return;
        if (!ensureDrivePreconditions()) return;
        const videoKey = getCanonicalVideoUrl();
        if (autoDriveAttemptedForVideo === videoKey) return;
        autoDriveAttemptedForVideo = videoKey;
        if (driveListingInProgress || driveSelectionInProgress) return;
        driveSelectionInProgress = true;
        try {
            const { files, token } = await fetchDriveSubtitleFileList();
            const best = files[0];
            if (!best) {
                setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
                return;
            }
            setLabelState('loading');
            const authToken = token || await ensureDriveAccessToken();
            const content = await downloadDriveFileContent(best.id, authToken);
            if (!content) {
                setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
                return;
            }
            const success = applySubtitleText(content);
            if (!success) {
                setLabelState('default');
            }
        } catch (error) {
            console.warn('Auto Drive load failed:', error);
            setLabelState(hasLoadedSubtitles() ? 'loaded' : 'default');
        } finally {
            driveSelectionInProgress = false;
        }
    }

    function openGoogleDriveFilePicker() {
        if (!ensureDrivePreconditions()) {
            openSettingsPanel('drive');
            requestAnimationFrame(() => focusDriveSettingsField('clientId'));
            return;
        }
        showDrivePickerOverlay();
        if (driveSelectionInProgress) {
            setDrivePickerStatus('loading', getDriveStrings().messages.loading);
            return;
        }
        loadDrivePickerFileList();
    }

    function registerDriveMenuCommands() {
        if (driveMenuRegistered || typeof GM_registerMenuCommand !== 'function') {
            if (typeof GM_registerMenuCommand !== 'function' && !driveMenuRegistered) {
                console.warn('GM_registerMenuCommand unavailable; Drive menu disabled.');
            }
            return;
        }
        const labels = getDriveStrings();
        GM_registerMenuCommand(labels.menuLoad, openGoogleDriveFilePicker);
        GM_registerMenuCommand(labels.menuConfigure, promptDriveCredentials);
        driveMenuRegistered = true;
    }
/* -------------------------------------------------------------------------- *
 * Module 10 · Cleanup routines and SPA-aware initialization
 * -------------------------------------------------------------------------- */

    function cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (labelThemeCleanup) {
            labelThemeCleanup();
            labelThemeCleanup = null;
        }
        if (panelThemeCleanup) {
            panelThemeCleanup();
            panelThemeCleanup = null;
        }
        if (themeObserver) {
            themeObserver.disconnect();
            themeObserver = null;
        }
        if (colorSchemeListener?.media) {
            const { media, listener } = colorSchemeListener;
            if (media.removeEventListener) {
                media.removeEventListener('change', listener);
            } else if (media.removeListener) {
                media.removeListener(listener);
            }
            colorSchemeListener = null;
        }
        document.getElementById('custom-subtitle-display')?.remove();
        resetSuccessHighlight();
        document.getElementById('local-subtitle-input-container')?.remove();
        if (inlineMessageTimer) {
            clearTimeout(inlineMessageTimer);
            inlineMessageTimer = null;
        }
        if (inlineMessageRef) {
            inlineMessageRef.remove();
            inlineMessageRef = null;
        }
        cancelEffectPreview();
        cancelScheduledFilePicker();
        if (buttonTooltipCleanup) {
            buttonTooltipCleanup();
            buttonTooltipCleanup = null;
        }
        destroyDrivePickerOverlay();
        destroyNativeTooltipElement();
        resetDriveVideoTitleCache();
        resetDriveAutomationState();
        fileInputLabelRef = null;
        fileInputLabelTextRef = null;
        completionBarRef = null;
        settingsPanelRef?.remove();
        settingsPanelRef = null;
        buttonInteractiveRef = null;
        buttonWrapperRef = null;
        lastSubtitleText = '';

        subtitles = [];
        videoElement = null;
        subtitleContainer = null;
        uiInjected = false;
        console.log('Subtitle script resources cleaned up.');
    }

    // 初始化函数：判断页面并启动脚本
    function initialize() {
        cleanup(); // 每次导航都先清理，确保纯净的环境

        // 仅在视频页执行
        if (window.location.pathname !== '/watch') {
            return;
        }

        console.log('Video page detected. Initializing subtitle loader...');

        // 使用 MutationObserver 等待播放器和操作按钮加载完成
        const observer = new MutationObserver((mutations, obs) => {
            const actions = document.querySelector('#below #actions');
            const player = document.querySelector('#movie_player video');
            if (actions && player && !uiInjected) {
                injectUI();
                obs.disconnect(); // 找到元素并注入UI后，断开此观察者
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    loadSettings();
    loadDriveSettings();
    registerSettingsMenu();
    registerDriveMenuCommands();

    // ---- Main Execution ----
    document.addEventListener('click', handleGlobalSettingsClick, true);
    // 监听YouTube的SPA导航事件
    document.addEventListener('yt-navigate-finish', initialize);

    // 首次加载时直接运行一次，以处理直接打开视频页的情况
    initialize();

})();
