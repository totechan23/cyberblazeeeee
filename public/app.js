const reportForm = document.getElementById('reportForm');
const feedback = document.getElementById('feedback');
const statsGrid = document.getElementById('statsGrid');
const bars = document.getElementById('bars');
const sosBtn = document.getElementById('sosBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const reportMessageInput = document.getElementById('reportMessageInput');
const reportVoiceBtn = document.getElementById('reportVoiceBtn');
const reportVoiceStatus = document.getElementById('reportVoiceStatus');
const chatVoiceBtn = document.getElementById('chatVoiceBtn');
const chatVoiceStatus = document.getElementById('chatVoiceStatus');
let sosFlashTimer = null;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

async function apiFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function flashSOSScreen() {
  document.body.classList.add('sos-flash-active');
  if (sosFlashTimer) window.clearTimeout(sosFlashTimer);
  sosFlashTimer = window.setTimeout(() => {
    document.body.classList.remove('sos-flash-active');
    sosFlashTimer = null;
  }, 650);
}

async function raiseSOS(triggerReason = 'Emergency alert from SOS button') {
  const payload = {
    citizenName: 'SOS Caller',
    location: 'Unknown',
    message: triggerReason,
    manualType: 'sos',
  };

  const data = await apiFetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const chatbotReply = data.chatbotReply || 'SOS received. Help is on the way.';
  feedback.textContent = `🚨 SOS raised successfully. Case ID ${data.report.id}\n${chatbotReply}`;
  feedback.style.color = '#ff8f9a';
  console.log(`Civic AI Chatbot: ${chatbotReply}`);
  renderStats(data.stats);
  flashSOSScreen();

  return data;
}

function renderStats(stats = {}) {
  const labels = ['total', 'sos', 'complaint', 'query', 'pending', 'resolved'];
  statsGrid.innerHTML = labels
    .map((key) => `<div class="stat"><h3>${key.toUpperCase()}</h3><p>${safeNumber(stats[key])}</p></div>`)
    .join('');

  const max = Math.max(safeNumber(stats.sos), safeNumber(stats.complaint), safeNumber(stats.query), 1);
  bars.innerHTML = ['sos', 'complaint', 'query']
    .map((type) => {
      const value = safeNumber(stats[type]);
      const height = Math.max(10, Math.round((value / max) * 140));
      return `<div class="bar" style="height:${height}px">${escapeHtml(type)}<br>${value}</div>`;
    })
    .join('');
}

function addChatMessage(role, text) {
  if (!chatMessages) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `<strong>${role === 'user' ? 'You' : 'Civic AI'}:</strong> ${escapeHtml(text)}`;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupVoiceInput({ button, targetInput, statusElement }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!button || !targetInput || !statusElement) return;

  if (!SpeechRecognition) {
    button.disabled = true;
    statusElement.textContent = 'Voice input is not supported in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  let active = false;

  recognition.onstart = () => {
    active = true;
    button.classList.add('listening');
    statusElement.textContent = 'Listening… speak now.';
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    targetInput.value = transcript.trim();
  };

  recognition.onend = () => {
    active = false;
    button.classList.remove('listening');
    statusElement.textContent = targetInput.value ? 'Voice captured.' : 'No speech detected.';
  };

  recognition.onerror = (event) => {
    active = false;
    button.classList.remove('listening');
    statusElement.textContent = `Voice error: ${event.error}`;
  };

  button.addEventListener('click', () => {
    if (active) {
      recognition.stop();
      return;
    }
    statusElement.textContent = '';
    recognition.start();
  });
}

async function loadStats() {
  try {
    const data = await apiFetch('/api/stats');
    renderStats(data);
  } catch (error) {
    feedback.textContent = `Unable to load stats: ${error.message}`;
    feedback.style.color = '#ffd166';
  }
}

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedback.textContent = 'Submitting...';
  feedback.style.color = '#90f5ec';

  try {
    const formData = new FormData(reportForm);
    const payload = Object.fromEntries(formData.entries());
    const data = await apiFetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const chatbotReply = data.chatbotReply || 'Your request has been received.';
    const routingLine = data.report.type === 'complaint'
      ? `\nRouted to: ${data.report.department} (${data.report.complaintType})`
      : '';
    feedback.textContent = `Case ${data.report.id} submitted as ${data.report.type.toUpperCase()}${routingLine}\n${chatbotReply}`;
    console.log(`Civic AI Chatbot: ${chatbotReply}`);
    reportForm.reset();
    renderStats(data.stats);
  } catch (error) {
    feedback.textContent = `Error: ${error.message}`;
    feedback.style.color = '#ff8f9a';
  }
});

sosBtn.addEventListener('click', async () => {
  try {
    await raiseSOS('Emergency alert from SOS button');
  } catch (error) {
    feedback.textContent = `SOS failed: ${error.message}`;
    feedback.style.color = '#ffd166';
  }
});

if (chatForm && chatInput && chatMessages) {
  addChatMessage('assistant', 'Hello! I am Civic AI Assistant. I can triage emergencies, draft better complaints, answer civic queries, and summarize live system trends.');

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    addChatMessage('user', prompt);
    chatInput.value = '';

    try {
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const reply = data.reply || 'I am here to help with civic reports and SOS support.';
      const decision = data.decision
        ? `\nDecision: ${data.decision.intent} (confidence ${data.decision.confidence})\nNext actions: ${(data.decision.next_actions || []).join(', ')}`
        : '';
      addChatMessage('assistant', `${reply}${decision}`);

      if (data.decision?.intent === 'emergency') {
        sosBtn.classList.add('ai-triggered');
        window.setTimeout(() => sosBtn.classList.remove('ai-triggered'), 900);
        await raiseSOS(`AI-detected emergency from chat: ${prompt}`);
        addChatMessage('assistant', '🚨 I detected an SOS emergency and automatically triggered the SOS alert.');
      }
    } catch (error) {
      addChatMessage('assistant', `Sorry, chat is unavailable right now: ${error.message}`);
    }
  });
}

loadStats();
setInterval(loadStats, 8000);

setupVoiceInput({
  button: reportVoiceBtn,
  targetInput: reportMessageInput,
  statusElement: reportVoiceStatus,
});

setupVoiceInput({
  button: chatVoiceBtn,
  targetInput: chatInput,
  statusElement: chatVoiceStatus,
});
