const reportForm = document.getElementById('reportForm');
const feedback = document.getElementById('feedback');
const statsGrid = document.getElementById('statsGrid');
const bars = document.getElementById('bars');
const sosBtn = document.getElementById('sosBtn');

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

  feedback.textContent = `Case ${data.report.id} submitted as ${data.report.type.toUpperCase()}`;
  feedback.style.color = '#90f5ec';
  reportForm.reset();
  renderStats(data.stats);
});

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
  feedback.textContent = res.ok
    ? `🚨 SOS raised successfully. Case ID ${data.report.id}`
    : `SOS failed: ${data.error}`;
  feedback.style.color = res.ok ? '#ff8f9a' : '#ffd166';
  if (res.ok) renderStats(data.stats);
});

loadStats();
setInterval(loadStats, 8000);
