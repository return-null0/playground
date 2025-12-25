import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// DOM Elements 
const chatHistory = document.getElementById("chatHistory");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const loadBtn = document.getElementById("loadBtn");
const status = document.getElementById("status");


let engine = null;
let activeGenId = 0; // "Ticket Number" to invalidate old loops


// We keep the history here. We ONLY add to this if a message completes successfully.
let messageLog = [
  { role: "system", content: "You are a helpful AI assistant." }
];

//  UNDO BUFFERS
let currentAiBubble = null;
let currentUserBubble = null;
let currentPromptText = "";

const SELECTED_MODEL = window.electron?.env?.MODEL_ID || "Mistral-7B-Instruct-v0.3-q4f16_1-MLC";

// 1. INITIALIZATION 
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

// 2. SEND LOGIC 
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


  activeGenId++;
  const currentJobId = activeGenId;


  currentPromptText = text;
  promptInput.value = "";
  

  sendBtn.style.display = "none";
  stopBtn.style.display = "block";
  status.innerText = "Generating...";


  currentUserBubble = addMessage(text, "user");
  currentAiBubble = addMessage("", "ai");

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
      // If ticket changed, stop immediately
      if (activeGenId !== currentJobId) return;

      const delta = chunk.choices[0]?.delta?.content || "";
      aiResponseText += delta;
      currentAiBubble.innerText = aiResponseText;
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }


    if (activeGenId === currentJobId) {
      // Commit to Permanent Log
      messageLog.push({ role: "user", content: text });
      messageLog.push({ role: "assistant", content: aiResponseText });
      
      resetButtons();
    }

  } catch (err) {
    // Ignore errors if we stopped manually (ticket mismatch)
    if (activeGenId === currentJobId) {
      currentAiBubble.innerText += " [Error]";
      console.error(err);
      resetButtons();
    }
  }
}

// 3. STOP (Fast Interrupt Method) 

stopBtn.addEventListener("click", async () => {
  console.log("📝 Stop clicked. Executing Fast Interrupt.");


  activeGenId++; 


  if (currentUserBubble) currentUserBubble.remove();
  if (currentAiBubble) currentAiBubble.remove();
  promptInput.value = currentPromptText; // Restore text


  resetButtons();


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
 * Based on community findings (red-reddington/soulofmischief).
 * Manually releases locks that interruptGenerate() misses.
 * //ref https://github.com/mlc-ai/mlc-llm/issues/3113
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
  
  // Essential so the AI doesn't remember the half-finished sentence.
  await engine.resetChat();
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
  div.innerText = text;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return div;
}