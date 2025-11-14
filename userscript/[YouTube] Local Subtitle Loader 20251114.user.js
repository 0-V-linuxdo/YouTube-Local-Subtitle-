// ==UserScript==
// @name         [YouTube] Local Subtitle Loader 20251114
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds a button to load local SRT/VTT subtitles on YouTube. Works with YouTube's single-page design and supports mobile.
// @author       Ki & Gemini
// @match        https://www.youtube.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 在这里自定义字幕样式 ---
    const subtitleStyle = `
        position: absolute;
        bottom: 8%; /* 字幕距离底部的距离 */
        width: 90%; /* 字幕区域宽度 */
        left: 5%;   /* 居中 */
        text-align: center;
        pointer-events: none;
        z-index: 99999; /* 确保在最顶层，避免被遮挡 */
        font-size: 2.2em; /* 字体大小 */
        color: white; /* 字体颜色 */
        font-weight: bold;
        text-shadow: 2px 2px 2px #000000, -2px -2px 2px #000000, 2px -2px 2px #000000, -2px 2px 2px #000000; /* 黑色描边，增强可读性 */
        font-family: Arial, "Heiti SC", "Microsoft Yahei", sans-serif;
        line-height: 1.4;
    `;

    let subtitles = [];
    let videoElement = null;
    let subtitleContainer = null;
    let animationFrameId = null;
    let uiInjected = false;

    // 检测是否为移动设备或移动浏览器
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

    // 更新字幕显示
    function updateSubtitles() {
        if (!videoElement || !subtitleContainer) {
            animationFrameId = requestAnimationFrame(updateSubtitles);
            return;
        }
        const currentTime = videoElement.currentTime;
        const currentSub = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
        if (currentSub && subtitleContainer.innerHTML !== currentSub.text) {
            subtitleContainer.innerHTML = currentSub.text.replace(/\n/g, '<br>');
            subtitleContainer.style.visibility = 'visible';
        } else if (!currentSub && subtitleContainer.innerHTML !== '') {
            subtitleContainer.innerHTML = '';
            subtitleContainer.style.visibility = 'hidden';
        }
        animationFrameId = requestAnimationFrame(updateSubtitles);
    }

    // 处理文件选择
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!isSubtitleFile(file)) {
            alert('请选择有效的字幕文件（.srt 或 .vtt 格式）。');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            subtitles = parseSubtitles(content);
            if (subtitles.length > 0) {
                alert(`字幕加载成功！共 ${subtitles.length} 条。`);
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                updateSubtitles();
            } else {
                alert('无法解析字幕文件，请检查文件格式是否正确 (支持 SRT 和 VTT) 或文件编码是否为 UTF-8。');
            }
        };
        reader.onerror = function() {
            alert('文件读取失败，请重试。');
        };
        reader.readAsText(file, 'UTF-8');
    }

    // 创建并注入UI元素
    function injectUI() {
        const player = document.querySelector('#movie_player');
        const actionsContainer = document.querySelector('#below #actions');
        if (!player || !actionsContainer) return;

        // --- 创建字幕显示容器 ---
        subtitleContainer = document.createElement('div');
        subtitleContainer.id = 'custom-subtitle-display';
        subtitleContainer.style.cssText = subtitleStyle;
        player.appendChild(subtitleContainer);

        // --- 创建文件选择器 ---
        const container = document.createElement('div');
        container.id = 'local-subtitle-input-container';
        container.style.cssText = `display: flex; align-items: center; margin: 0 8px;`;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        if (!isMobileDevice()) {
            fileInput.accept = '.srt,.vtt,text/plain,text/vtt';
        }
        fileInput.style.display = 'none';
        fileInput.id = 'local-subtitle-input';
        fileInput.addEventListener('change', handleFileSelect);

        const fileInputLabel = document.createElement('label');
        fileInputLabel.htmlFor = 'local-subtitle-input';
        fileInputLabel.textContent = '加载字幕';
        fileInputLabel.style.cssText = `
            cursor: pointer; background-color: #eee; color: #333; padding: 8px 12px;
            border-radius: 18px; font-size: 14px; font-weight: 500; transition: background-color 0.3s;
            white-space: nowrap; user-select: none; -webkit-tap-highlight-color: transparent;
        `;

        const isDarkMode = document.documentElement.getAttribute('dark') === 'true';
        if (isDarkMode) {
            fileInputLabel.style.backgroundColor = '#3f3f3f';
            fileInputLabel.style.color = '#fff';
        }

        fileInputLabel.onmouseover = () => fileInputLabel.style.backgroundColor = isDarkMode ? '#555' : '#ccc';
        fileInputLabel.onmouseout = () => fileInputLabel.style.backgroundColor = isDarkMode ? '#3f3f3f' : '#eee';
        fileInputLabel.ontouchstart = () => fileInputLabel.style.backgroundColor = isDarkMode ? '#555' : '#ccc';
        fileInputLabel.ontouchend = () => setTimeout(() => fileInputLabel.style.backgroundColor = isDarkMode ? '#3f3f3f' : '#eee', 150);

        container.appendChild(fileInput);
        container.appendChild(fileInputLabel);

        const shareButton = actionsContainer.querySelector('ytd-button-renderer:nth-child(2)');
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
    }

    // 清理函数：移除UI，重置状态
    function cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        document.getElementById('custom-subtitle-display')?.remove();
        document.getElementById('local-subtitle-input-container')?.remove();

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

    // ---- Main Execution ----
    // 监听YouTube的SPA导航事件
    document.addEventListener('yt-navigate-finish', initialize);

    // 首次加载时直接运行一次，以处理直接打开视频页的情况
    initialize();

})();
