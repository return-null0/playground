import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// --- DOM Elements ---
const chatHistory = document.getElementById("chatHistory");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const loadBtn = document.getElementById("loadBtn");
const status = document.getElementById("status");

// --- State Variables ---
let engine = null;
let activeGenId = 0; // "Ticket Number" to invalidate old loops

// 🧠 CONVERSATION HISTORY
let messageLog = [
  { role: "system", content: "You are a helpful AI assistant." }
];

// ↩️ UNDO BUFFERS
let currentAiBubble = null;
let currentUserBubble = null;
let currentPromptText = "";

const SELECTED_MODEL = window.electron?.env?.MODEL_ID || "Mistral-7B-Instruct-v0.3-q4f16_1-MLC";

// --- 1. INITIALIZATION ---
loadBtn.addEventListener("click", async () => {
  try {
    loadBtn.disabled = true;
    status.innerText = "Initializing...";
    
    engine = await CreateMLCEngine(SELECTED_MODEL, {
      initProgressCallback: (report) => {
        if (report.text.includes("Loading")) status.innerText = report.text;
      }
    });

    enableUI();
  } catch (err) {
    console.error(err);
    status.innerText = "Error";
    loadBtn.disabled = false;
  }
});

// --- 2. SEND LOGIC ---
sendBtn.addEventListener("click", handleSend);
promptInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

async function handleSend() {
  const text = promptInput.value.trim();
  if (!text || !engine) return;

  // 1. Setup New Job Ticket
  activeGenId++;
  const currentJobId = activeGenId;

  // 2. Save State (For Undo)
  currentPromptText = text;
  promptInput.value = "";
  
  // 3. UI Updates
  sendBtn.style.display = "none";
  stopBtn.style.display = "block";
  status.innerText = "Generating...";

  // 4. Create UI Bubbles
  currentUserBubble = addMessage(text, "user");
  currentAiBubble = addMessage("", "ai");

  // 5. Prepare History
  const tempHistory = [...messageLog, { role: "user", content: text }];
  let aiResponseText = "";

  try {
    const chunks = await engine.chat.completions.create({
      messages: tempHistory, 
      stream: true, 
      temperature: 0.7,
      max_tokens: 1024 
    });

    for await (const chunk of chunks) {
      // 🛑 STOP: If ticket changed, stop immediately
      if (activeGenId !== currentJobId) return;

      const delta = chunk.choices[0]?.delta?.content || "";
      aiResponseText += delta;

      // ✨ FORMATTING: Parse Markdown on every frame
      currentAiBubble.innerHTML = formatText(aiResponseText);
      
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // ✅ SUCCESS
    if (activeGenId === currentJobId) {
      messageLog.push({ role: "user", content: text });
      messageLog.push({ role: "assistant", content: aiResponseText });
      resetButtons();
    }

  } catch (err) {
    if (activeGenId === currentJobId) {
      currentAiBubble.innerText += " [Error]";
      console.error(err);
      resetButtons();
    }
  }
}

// --- 3. STOP LOGIC (Fast Interrupt) ---
stopBtn.addEventListener("click", async () => {
  console.log("📝 Stop clicked. Executing Fast Interrupt.");

  // 1. Invalidate Loop
  activeGenId++; 

  // 2. Undo UI
  if (currentUserBubble) currentUserBubble.remove();
  if (currentAiBubble) currentAiBubble.remove();
  promptInput.value = currentPromptText; 

  resetButtons();

  // 3. Fix Engine
  if (engine) {
    try {
      await fastInterrupt();
      console.log("📝 Engine successfully reset.");
    } catch (e) {
      console.warn("Fast Interrupt failed:", e);
    }
  }
});

/**
 * 🛠️ FAST INTERRUPT HELPER
 * Manually releases locks that interruptGenerate() misses.
 */
async function fastInterrupt() {
  await engine.interruptGenerate();
  
  if (engine.interruptSignal !== undefined) {
    engine.interruptSignal = false;
  }
  
  if (engine.loadedModelIdToLock) {
    const lock = engine.loadedModelIdToLock.get(SELECTED_MODEL);
    if (lock && lock.acquired) {
      console.log("📝 Releasing stuck lock manually...");
      await lock.release();
    }
  }
  
  await engine.resetChat();
}

// --- HELPER FUNCTIONS ---

/**
 * 🎨 MARKDOWN FORMATTER
 * Detects code blocks (```) and wraps them in <pre><code> tags.
 */
function formatText(text) {
  // If there are no code blocks, just return safe text
  if (!text.includes("```")) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  const parts = text.split("```");
  
  return parts.map((part, index) => {
    if (index % 2 === 0) {
      // NORMAL TEXT: Escape HTML and convert newlines
      return escapeHtml(part).replace(/\n/g, "<br>");
    } else {
      // CODE BLOCK:
      // 1. Trim first line if it's a language name (e.g. "javascript")
      let content = part;
      const firstLineBreak = content.indexOf('\n');
      if (firstLineBreak > -1 && firstLineBreak < 20) {
        content = content.substring(firstLineBreak + 1);
      }
      
      // 2. Wrap in proper tags (preserve whitespace via CSS)
      return `<pre><code>${escapeHtml(content)}</code></pre>`;
    }
  }).join("");
}

// Simple security escape to prevent XSS
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resetButtons() {
  stopBtn.style.display = "none";
  sendBtn.style.display = "block";
  status.innerText = "Ready";
  promptInput.focus();
}

function enableUI() {
  promptInput.disabled = false;
  sendBtn.disabled = false;
  promptInput.focus();
  loadBtn.style.display = "none";
  status.innerText = "Ready";
  addMessage("System: AI Loaded.", "system");
}

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  
  // Use innerHTML for AI (to support code blocks), innerText for User (safety)
  if (role === 'ai') {
    div.innerHTML = formatText(text); 
  } else if (role === 'system') {
    div.innerText = text;
  } else {
    div.innerText = text;
  }
  
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return div;
}