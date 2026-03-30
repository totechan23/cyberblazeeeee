const reportForm = document.getElementById('reportForm');
const feedback = document.getElementById('feedback');
const statsGrid = document.getElementById('statsGrid');
const bars = document.getElementById('bars');
const sosBtn = document.getElementById('sosBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');

function addChatMessage(sender, text) {
  const row = document.createElement('p');
  const label = document.createElement('strong');
  label.textContent = `${sender}: `;
  row.appendChild(label);
  row.appendChild(document.createTextNode(text));
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderStats(stats) {
  const labels = ['total', 'sos', 'complaint', 'query', 'pending', 'resolved'];
  statsGrid.innerHTML = labels
    .map((key) => `<div class="stat"><h3>${key.toUpperCase()}</h3><p>${stats[key] || 0}</p></div>`)
    .join('');

  const max = Math.max(stats.sos, stats.complaint, stats.query, 1);
  bars.innerHTML = ['sos', 'complaint', 'query']
    .map((type) => {
      const h = Math.max(10, Math.round(((stats[type] || 0) / max) * 140));
      return `<div class="bar" style="height:${h}px">${type}<br>${stats[type] || 0}</div>`;
    })
    .join('');
}

async function loadStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  renderStats(data);
}

if (reportForm && feedback) {
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.textContent = 'Submitting...';
    const formData = new FormData(reportForm);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      feedback.textContent = `Error: ${data.error}`;
      feedback.style.color = '#ff8f9a';
      return;
    }

    const chatbotReply = data.chatbotReply || 'Your request has been received.';
    feedback.textContent = `Case ${data.report.id} submitted as ${data.report.type.toUpperCase()}\n${chatbotReply}`;
    feedback.style.color = '#90f5ec';
    console.log(`Civic AI Chatbot: ${chatbotReply}`);
    reportForm.reset();
    renderStats(data.stats);
  });
}

if (sosBtn && feedback) {
  sosBtn.addEventListener('click', async () => {
    const payload = {
      citizenName: 'SOS Caller',
      location: 'Unknown',
      message: 'Emergency alert from SOS button',
      manualType: 'sos',
    };

    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const chatbotReply = data.chatbotReply || 'SOS received. Help is on the way.';
    feedback.textContent = res.ok
      ? `🚨 SOS raised successfully. Case ID ${data.report.id}\n${chatbotReply}`
      : `SOS failed: ${data.error}`;
    feedback.style.color = res.ok ? '#ff8f9a' : '#ffd166';
    if (res.ok) console.log(`Civic AI Chatbot: ${chatbotReply}`);
    if (res.ok) renderStats(data.stats);
  });
}

if (chatForm && chatInput && chatLog) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    addChatMessage('You', message);
    chatInput.value = '';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    const reply = res.ok ? data.reply : (data.error || 'Unable to respond right now.');
    addChatMessage('AI', reply);
    console.log(`Civic AI Chat: ${reply}`);
  });
}

if (statsGrid && bars) {
  loadStats();
  setInterval(loadStats, 8000);
}
