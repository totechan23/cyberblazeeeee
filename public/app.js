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
const liveClock = document.getElementById('liveClock');
const liveMessage = document.getElementById('liveMessage');
const emergencyContacts = document.getElementById('emergencyContacts');
let sosFlashTimer = null;
let emergencyContactsTimer = null;
let emergencyVoiceTimer = null;
let liveTickerTimer = null;

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

function showEmergencyContacts() {
  if (!emergencyContacts) return;
  emergencyContacts.classList.add('active');
  if (emergencyContactsTimer) window.clearTimeout(emergencyContactsTimer);
  emergencyContactsTimer = window.setTimeout(() => {
    emergencyContacts.classList.remove('active');
    emergencyContactsTimer = null;
  }, 5000);
}

function speakEmergencyAlert(message = 'Emergency detected. Sending SOS alert now. Please stay calm and move to a safe location if possible. If life is in danger, call 112 immediately.') {
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
    return;
  }

  if (emergencyVoiceTimer) {
    window.clearTimeout(emergencyVoiceTimer);
    emergencyVoiceTimer = null;
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(message);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Delay slightly so speech is more reliable right after user actions.
  emergencyVoiceTimer = window.setTimeout(() => {
    window.speechSynthesis.speak(utterance);
    emergencyVoiceTimer = null;
  }, 100);
}

async function raiseSOS(
  triggerReason = 'Emergency alert from SOS button',
  voiceMessage = 'Emergency detected. Sending SOS alert now. Please stay calm and move to a safe location if possible. If life is in danger, call 112 immediately.',
) {
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
  showEmergencyContacts();
  speakEmergencyAlert(voiceMessage);

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

function startLiveClock() {
  if (!liveClock) return;
  const updateClock = () => {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString([], { hour12: false });
  };
  updateClock();
  window.setInterval(updateClock, 1000);
}

function startLiveTicker() {
  if (!liveMessage) return;
  const messages = [
    'Civic AI feed is active and listening.',
    'Realtime routing online for SOS, complaints, and citizen queries.',
    'Monitoring city incident trends every 8 seconds.',
    'AI triage assistant is ready for the next request.',
  ];
  let index = 0;
  liveTickerTimer = window.setInterval(() => {
    index = (index + 1) % messages.length;
    liveMessage.textContent = messages[index];
  }, 4200);
}

function addCardTilt() {
  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateY = ((x / rect.width) - 0.5) * 5;
      const rotateX = (0.5 - (y / rect.height)) * 5;
      card.style.transform = `translateY(-3px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
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
  recognition.maxAlternatives = 1;

  let active = false;
  let finalTranscript = '';
  let hasMicrophonePermission = false;
  let restartBlockedUntil = 0;
  const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isSecureContext) {
    button.disabled = true;
    statusElement.textContent = 'Voice input requires HTTPS (or localhost).';
    return;
  }

  async function ensureMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      statusElement.textContent = 'Microphone access is unavailable in this browser.';
      return false;
    }

    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        if (permission.state === 'denied') {
          hasMicrophonePermission = false;
          statusElement.textContent = 'Microphone permission is blocked. Enable it in browser settings.';
          return false;
        }
        if (permission.state === 'granted') {
          hasMicrophonePermission = true;
          return true;
        }
      } catch {
        // Some browsers do not support querying "microphone" permissions.
        // Fall back to getUserMedia permission request below.
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      hasMicrophonePermission = true;
      return true;
    } catch (error) {
      hasMicrophonePermission = false;
      statusElement.textContent = 'Microphone permission was denied. Please allow access and try again.';
      return false;
    }
  }

  recognition.onstart = () => {
    active = true;
    finalTranscript = '';
    button.classList.add('listening');
    statusElement.textContent = 'Listening… speak now.';
  };

  recognition.onresult = (event) => {
    let transcript = finalTranscript;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0].transcript || '';
      if (event.results[i].isFinal) {
        finalTranscript += chunk;
      }
      transcript += chunk;
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
    if (event.error === 'not-allowed') {
      hasMicrophonePermission = false;
      statusElement.textContent = 'Microphone permission denied. Allow access to use voice input.';
      return;
    }
    if (event.error === 'audio-capture') {
      statusElement.textContent = 'No microphone detected. Check your audio input device.';
      return;
    }
    if (event.error === 'network') {
      statusElement.textContent = 'Speech service network error. Check internet connection and retry.';
      return;
    }
    if (event.error === 'aborted') {
      statusElement.textContent = 'Voice input stopped.';
      return;
    }
    if (event.error === 'no-speech') {
      statusElement.textContent = 'No speech detected. Try again and speak closer to the microphone.';
      restartBlockedUntil = Date.now() + 900;
      return;
    }
    statusElement.textContent = `Voice error: ${event.error}`;
  };

  button.addEventListener('click', async () => {
    if (active) {
      recognition.stop();
      return;
    }

    if (Date.now() < restartBlockedUntil) {
      statusElement.textContent = 'Please wait a moment, then tap voice input again.';
      return;
    }

    if (!hasMicrophonePermission) {
      const hasPermission = await ensureMicrophonePermission();
      if (!hasPermission) return;
    }

    statusElement.textContent = '';
    try {
      recognition.start();
    } catch (error) {
      if (error.name === 'InvalidStateError') {
        statusElement.textContent = 'Voice input is already starting. Please wait a moment.';
        return;
      }
      statusElement.textContent = `Unable to start voice input: ${error.message}`;
    }
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
  addChatMessage('assistant', 'Hello! I am Civic AI. I can help with emergencies and city services, and I can also chat about general topics like writing, coding, planning, and ideas.');

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
      const reply = data.reply || 'I can help with civic reports, SOS support, and general questions too.';
      const decision = data.decision
        ? `\nDecision: ${data.decision.intent} (confidence ${data.decision.confidence})\nNext actions: ${(data.decision.next_actions || []).join(', ')}`
        : '';
      addChatMessage('assistant', `${reply}${decision}`);

      if (data.decision?.intent === 'emergency') {
        sosBtn.classList.add('ai-triggered');
        window.setTimeout(() => sosBtn.classList.remove('ai-triggered'), 900);
        await raiseSOS(
          `AI-detected emergency from chat: ${prompt}`,
          'Emergency detected from chat. SOS has been triggered automatically.',
        );
        addChatMessage('assistant', '🚨 I detected an SOS emergency and automatically triggered the SOS alert.');
      }
    } catch (error) {
      addChatMessage('assistant', `Sorry, chat is unavailable right now: ${error.message}`);
    }
  });
}

loadStats();
setInterval(loadStats, 8000);
startLiveClock();
startLiveTicker();
addCardTilt();

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
