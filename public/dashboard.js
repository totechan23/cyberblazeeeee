const statsGrid = document.getElementById('statsGrid');
const reportsTable = document.getElementById('reportsTable');

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
}

function rowTemplate(report) {
  return `
    <tr>
      <td>${escapeHtml(report.id)}</td>
      <td><span class="tag ${escapeHtml(report.type)}">${escapeHtml(report.type)}</span></td>
      <td>${escapeHtml(report.citizenName)}</td>
      <td>${escapeHtml(report.location)}</td>
      <td>${escapeHtml(report.message)}</td>
      <td><span class="tag ${escapeHtml(report.status)}">${escapeHtml(report.status)}</span></td>
      <td><button class="btn" onclick="toggleStatus('${escapeHtml(report.id)}')">Toggle</button></td>
    </tr>
  `;
}

async function loadDashboard() {
  try {
    const [stats, reports] = await Promise.all([
      apiFetch('/api/stats'),
      apiFetch('/api/reports'),
    ]);

    renderStats(stats);
    reportsTable.innerHTML = reports.map(rowTemplate).join('') || '<tr><td colspan="7">No cases yet</td></tr>';
  } catch (error) {
    reportsTable.innerHTML = `<tr><td colspan="7">Unable to load dashboard: ${escapeHtml(error.message)}</td></tr>`;
  }
}

window.toggleStatus = async (id) => {
  try {
    await apiFetch(`/api/report/${encodeURIComponent(id)}`, { method: 'PATCH' });
    await loadDashboard();
  } catch (error) {
    reportsTable.innerHTML = `<tr><td colspan="7">Unable to update status: ${escapeHtml(error.message)}</td></tr>`;
  }
};

loadDashboard();
setInterval(loadDashboard, 8000);
