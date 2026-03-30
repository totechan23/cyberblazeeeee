const reportForm = document.getElementById('reportForm');
const feedback = document.getElementById('feedback');
const statsGrid = document.getElementById('statsGrid');
const bars = document.getElementById('bars');
const sosBtn = document.getElementById('sosBtn');

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
    feedback.textContent = `Case ${data.report.id} submitted as ${data.report.type.toUpperCase()}\n${chatbotReply}`;
    console.log(`Civic AI Chatbot: ${chatbotReply}`);
    reportForm.reset();
    renderStats(data.stats);
  } catch (error) {
    feedback.textContent = `Error: ${error.message}`;
    feedback.style.color = '#ff8f9a';
  }
});

sosBtn.addEventListener('click', async () => {
  const payload = {
    citizenName: 'SOS Caller',
    location: 'Unknown',
    message: 'Emergency alert from SOS button',
    manualType: 'sos',
  };

  try {
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
  } catch (error) {
    feedback.textContent = `SOS failed: ${error.message}`;
    feedback.style.color = '#ffd166';
  }
});

loadStats();
setInterval(loadStats, 8000);
