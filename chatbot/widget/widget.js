/**
 * RoamIQ Chatbot Widget — Self-injecting vanilla JS chat bubble.
 * Loaded via: <script src="http://localhost:8001/widget.js"></script>
 * No dependencies — works with any page.
 */
(function () {
    const CHATBOT_API = "http://localhost:8001/api/chat";

    // ── State ──────────────────────────────────────────────
    let isOpen = false;
    let isLoading = false;
    let messages = [
        {
            role: "assistant",
            content:
                "Hi! I'm your RoamIQ Travel Assistant 🌍\n\nAsk me anything about destinations, packing tips, local cuisine, budgets, or itinerary ideas!",
        },
    ];

    // ── Inject styles ──────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
    #roamiq-chat-toggle {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #14b8a6, #059669);
      color: #fff;
      box-shadow: 0 4px 20px rgba(20, 184, 166, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #roamiq-chat-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(20, 184, 166, 0.45);
    }
    #roamiq-chat-toggle .ai-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: #fbbf24;
      color: #78350f;
      font-size: 8px;
      font-weight: 800;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #roamiq-chat-window {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 380px;
      height: 520px;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 50px rgba(0,0,0,0.25);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: roamiq-slide-up 0.3s ease-out;
      border: 1px solid rgba(255,255,255,0.12);
    }
    @media (max-width: 420px) {
      #roamiq-chat-window {
        width: calc(100vw - 16px);
        right: 8px;
        bottom: 8px;
        height: 70vh;
      }
    }
    @keyframes roamiq-slide-up {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    #roamiq-chat-window .rq-header {
      background: linear-gradient(135deg, #0d9488, #059669);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #roamiq-chat-window .rq-header-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }
    #roamiq-chat-window .rq-header-title {
      flex: 1;
    }
    #roamiq-chat-window .rq-header-title h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }
    #roamiq-chat-window .rq-header-title p {
      margin: 0;
      font-size: 10px;
      color: rgba(255,255,255,0.6);
    }
    #roamiq-chat-window .rq-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      transition: background 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #roamiq-chat-window .rq-close:hover {
      background: rgba(255,255,255,0.2);
      color: #fff;
    }

    #roamiq-chat-window .rq-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #0f172a;
    }

    .rq-msg {
      display: flex;
      gap: 8px;
      max-width: 90%;
    }
    .rq-msg.user {
      flex-direction: row-reverse;
      align-self: flex-end;
    }
    .rq-msg.assistant {
      align-self: flex-start;
    }
    .rq-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }
    .rq-msg.user .rq-msg-avatar {
      background: rgba(20,184,166,0.15);
      color: #14b8a6;
    }
    .rq-msg.assistant .rq-msg-avatar {
      background: rgba(251,191,36,0.15);
      color: #fbbf24;
    }
    .rq-msg-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .rq-msg.user .rq-msg-bubble {
      background: #0d9488;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .rq-msg.assistant .rq-msg-bubble {
      background: #1e293b;
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
    }

    .rq-typing {
      display: flex;
      gap: 8px;
      align-self: flex-start;
    }
    .rq-typing-dots {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 12px 16px;
      background: #1e293b;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
    }
    .rq-typing-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(148,163,184,0.5);
      animation: rq-bounce 1.2s infinite;
    }
    .rq-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .rq-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes rq-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    #roamiq-chat-window .rq-input-area {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: #0f172a;
    }
    #roamiq-chat-window .rq-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1e293b;
      border-radius: 12px;
      padding: 4px 4px 4px 14px;
    }
    #roamiq-chat-window .rq-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      color: #e2e8f0;
      font-size: 13px;
      font-family: inherit;
    }
    #roamiq-chat-window .rq-input::placeholder {
      color: rgba(148,163,184,0.5);
    }
    #roamiq-chat-window .rq-send {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: none;
      background: #0d9488;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    #roamiq-chat-window .rq-send:hover { background: #0f766e; }
    #roamiq-chat-window .rq-send:disabled { opacity: 0.4; cursor: not-allowed; }

    #roamiq-chat-window .rq-footer {
      text-align: center;
      font-size: 9px;
      color: rgba(148,163,184,0.4);
      padding: 6px 0 8px;
      background: #0f172a;
    }
  `;
    document.head.appendChild(style);

    // ── SVG icons ──────────────────────────────────────────
    const ICON_CHAT =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    const ICON_X =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const ICON_SEND =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    const ICON_SPARKLE =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>';
    const ICON_USER = "👤";
    const ICON_BOT = "🤖";

    // ── Create toggle button ───────────────────────────────
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "roamiq-chat-toggle";
    toggleBtn.innerHTML = ICON_CHAT + '<span class="ai-badge">AI</span>';
    toggleBtn.title = "RoamIQ Travel Assistant";
    document.body.appendChild(toggleBtn);

    // ── Render chat window ─────────────────────────────────
    function render() {
        // Remove existing window
        const existing = document.getElementById("roamiq-chat-window");
        if (existing) existing.remove();

        if (!isOpen) {
            toggleBtn.style.display = "flex";
            return;
        }
        toggleBtn.style.display = "none";

        const win = document.createElement("div");
        win.id = "roamiq-chat-window";

        // Header
        win.innerHTML = `
      <div class="rq-header">
        <div class="rq-header-icon">${ICON_SPARKLE}</div>
        <div class="rq-header-title">
          <h3>RoamIQ Assistant</h3>
          <p>AI-powered travel help</p>
        </div>
        <button class="rq-close" id="rq-close-btn">${ICON_X}</button>
      </div>
      <div class="rq-messages" id="rq-messages"></div>
      <div class="rq-input-area">
        <div class="rq-input-row">
          <input class="rq-input" id="rq-input" type="text" placeholder="Ask about your trip..." />
          <button class="rq-send" id="rq-send-btn" ${isLoading ? "disabled" : ""}>${ICON_SEND}</button>
        </div>
      </div>
      <div class="rq-footer">Powered by Gemini AI • RoamIQ</div>
    `;

        document.body.appendChild(win);

        // Render messages
        const msgContainer = document.getElementById("rq-messages");
        messages.forEach((msg) => {
            const div = document.createElement("div");
            div.className = `rq-msg ${msg.role === "user" ? "user" : "assistant"}`;
            div.innerHTML = `
        <div class="rq-msg-avatar">${msg.role === "user" ? ICON_USER : ICON_BOT}</div>
        <div class="rq-msg-bubble">${escapeHtml(msg.content)}</div>
      `;
            msgContainer.appendChild(div);
        });

        // Typing indicator
        if (isLoading) {
            const typing = document.createElement("div");
            typing.className = "rq-typing";
            typing.innerHTML = `
        <div class="rq-msg-avatar" style="background:rgba(251,191,36,0.15);color:#fbbf24;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px">${ICON_BOT}</div>
        <div class="rq-typing-dots"><span></span><span></span><span></span></div>
      `;
            msgContainer.appendChild(typing);
        }

        // Scroll to bottom
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Event listeners
        document.getElementById("rq-close-btn").addEventListener("click", () => {
            isOpen = false;
            render();
        });

        const input = document.getElementById("rq-input");
        input.focus();
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        document.getElementById("rq-send-btn").addEventListener("click", sendMessage);
    }

    // ── Send message ───────────────────────────────────────
    async function sendMessage() {
        const input = document.getElementById("rq-input");
        const text = input.value.trim();
        if (!text || isLoading) return;

        messages.push({ role: "user", content: text });
        input.value = "";
        isLoading = true;
        render();

        try {
            const history = messages.slice(0, -1).map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                content: m.content,
            }));

            const res = await fetch(CHATBOT_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history }),
            });
            const data = await res.json();

            if (data.error) {
                messages.push({ role: "assistant", content: "⚠️ " + data.error });
            } else {
                messages.push({ role: "assistant", content: data.reply });
            }
        } catch (err) {
            messages.push({
                role: "assistant",
                content: "⚠️ Could not reach chatbot server. Make sure it's running on port 8001.",
            });
        } finally {
            isLoading = false;
            render();
        }
    }

    // ── Helpers ────────────────────────────────────────────
    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
    }

    // ── Toggle handler ─────────────────────────────────────
    toggleBtn.addEventListener("click", () => {
        isOpen = true;
        render();
    });
})();
