// ==UserScript==
// @name         AID True multiplayer
// @namespace    http://tampermonkey.net/
// @version      0.1.5
// @description  Real-time collaborative sync of textarea and column container on AI Dungeon; activated via bottom-right button; both users have equal sync rights
// @author       Tokiw0_3
// @match        *://*.aidungeon.com/adventure/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const WS_URL_BASE = 'wss://aidungeon-multiplayer-fix.bagrat0209.workers.dev/ws';

    // === Activation Button ===
    const activateBtn = document.createElement('button');
    activateBtn.innerText = 'Start Sync';
    activateBtn.style.position = 'fixed';
    activateBtn.style.bottom = '10px';
    activateBtn.style.right = '10px';
    activateBtn.style.zIndex = '9999';
    activateBtn.style.padding = '10px 16px';
    activateBtn.style.borderRadius = '8px';
    activateBtn.style.border = 'none';
    activateBtn.style.background = '#4CAF50';
    activateBtn.style.color = 'white';
    activateBtn.style.fontSize = '14px';
    activateBtn.style.cursor = 'pointer';
    activateBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    document.body.appendChild(activateBtn);

    activateBtn.addEventListener('click', () => {
        activateBtn.remove();
        main();
    });

    // === Generate Lobby Code ===
    function generateCode() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // === Wait for Main Textarea ===
    function waitForTextarea() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                const existing = document.querySelector('#game-text-input.css-11aywtz');
                if (existing) {
                    clearInterval(interval);
                    resolve(existing);
                }
            }, 300);
        });
    }

    // === Create Collaborator Textarea ===
    function createCollaboratorTextarea() {
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.placeholder = "Collaborator's input...";
        textarea.autocapitalize = "sentences";
        textarea.autocomplete = "on";
        textarea.autocorrect = "on";
        textarea.dir = "auto";
        textarea.spellcheck = true;
        textarea.virtualkeyboardpolicy = "auto";
        textarea.setAttribute('aria-label', 'Collaborator action input');
        textarea.setAttribute('data-disable-theme', 'true');
        textarea.tabIndex = 0;
        textarea.className = 'css-11aywtz r-6taxm2 true font_gameplaySans';
        textarea.style.setProperty('--placeholderTextColor', 'rgba(34, 228, 117, 0.35)');
        textarea.readOnly = false;
        return textarea;
    }

    async function promptSessionCode() {
        let code = prompt("Enter session code to join or leave blank to create new:");
        if (!code || !code.trim()) {
            code = generateCode();
            alert("New session created with code: " + code);
        }
        return code.trim().toUpperCase();
    }

    // === Main Function ===
    async function main() {
        const existingTextarea = await waitForTextarea();
        const collaboratorTextarea = createCollaboratorTextarea();
        existingTextarea.parentNode.insertBefore(collaboratorTextarea, existingTextarea);

        const sessionCode = await promptSessionCode();

        // === Show Session Code on Screen ===
        const codeDiv = document.createElement('div');
        codeDiv.textContent = `Session Code: ${sessionCode}`;
        codeDiv.style.position = 'fixed';
        codeDiv.style.bottom = '10px';
        codeDiv.style.right = '10px';
        codeDiv.style.background = '#222';
        codeDiv.style.color = '#fff';
        codeDiv.style.padding = '6px 10px';
        codeDiv.style.borderRadius = '6px';
        codeDiv.style.zIndex = '9999';
        codeDiv.style.fontSize = '13px';
        document.body.appendChild(codeDiv);

        const ws = new WebSocket(`${WS_URL_BASE}?session=${sessionCode}`);

        ws.onopen = () => console.log(`Connected to session ${sessionCode}`);
        ws.onclose = () => console.log("WebSocket disconnected");
        ws.onerror = (e) => console.error("WebSocket error", e);

        ws.onmessage = (event) => {
            let remoteText = null;
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'column-update') {
                    if (columnElement && data.content !== columnElement.innerHTML) {
                        observer.disconnect();
                        columnElement.innerHTML = data.content;
                        observer.observe(columnElement, mutationConfig);
                    }
                    return;
                }
                if (data.type === 'text-update') {
                    remoteText = data.content;
                }
            } catch {
                remoteText = event.data;
            }

            if (remoteText !== null) {
                if (remoteText !== existingTextarea.value && remoteText !== collaboratorTextarea.value) {
                    if (document.activeElement === existingTextarea) {
                        collaboratorTextarea.value = remoteText;
                    } else if (document.activeElement === collaboratorTextarea) {
                        existingTextarea.value = remoteText;
                    } else {
                        existingTextarea.value = remoteText;
                        collaboratorTextarea.value = remoteText;
                    }
                }
            }
        };

        let sendTimeout = null;
        function sendText(text) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'text-update', content: text }));
            }
        }

        function onInput(e) {
            if (sendTimeout) clearTimeout(sendTimeout);
            const text = e.target.value;
            sendTimeout = setTimeout(() => sendText(text), 150);
        }

        existingTextarea.addEventListener('input', onInput);
        collaboratorTextarea.addEventListener('input', onInput);

        // === Live Sync Column Container ===
        const columnSelector = '._dsp-flex._ai-stretch._fd-column._fb-auto._bxs-border-box._pos-relative._mih-0px._miw-0px._fs-0._pt-t-space-1._pr-t-space-1._pb-t-space-1._pl-t-space-1._h-10037._maw-424px._w-424px._bg-c-core0._blw-1px._btc-c-coreA1._brc-c-coreA1._bbc-c-coreA1._blc-c-coreA1._bls-solid';
        const columnElement = document.querySelector(columnSelector);
        if (!columnElement) {
            console.warn('Column element not found');
            return;
        }

        const mutationConfig = {
            childList: true,
            subtree: true,
            characterData: true,
        };

        const observer = new MutationObserver(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'column-update', content: columnElement.innerHTML }));
            }
        });

        observer.observe(columnElement, mutationConfig);
    }

})();
