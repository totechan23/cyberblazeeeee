const statsGrid = document.getElementById('statsGrid');
const sosTable = document.getElementById('sosTable');
const complaintsTable = document.getElementById('complaintsTable');
const queriesTable = document.getElementById('queriesTable');

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

function buildComplaintPriorityMap(complaints = []) {
  const complaintCountByType = complaints.reduce((acc, report) => {
    const complaintType = report.complaintType || 'general';
    acc[complaintType] = (acc[complaintType] || 0) + 1;
    return acc;
  }, {});

  const sortedComplaintTypes = Object.entries(complaintCountByType)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([complaintType]) => complaintType);

  return sortedComplaintTypes.reduce((acc, complaintType, index) => {
    acc[complaintType] = index + 1;
    return acc;
  }, {});
}

function rowTemplate(report, options = {}) {
  const { complaintPriorityMap = {} } = options;
  const complaintType = report.type === 'complaint' ? (report.complaintType || 'general') : '-';
  const department = report.type === 'complaint' ? (report.department || 'General Complaint Cell') : '-';
  const priority = report.type === 'complaint' ? (complaintPriorityMap[complaintType] || '-') : '-';
  return `
    <tr>
      <td>${escapeHtml(priority)}</td>
      <td>${escapeHtml(report.id)}</td>
      <td><span class="tag ${escapeHtml(report.type)}">${escapeHtml(report.type)}</span></td>
      <td><span class="tag tag-${escapeHtml(complaintType)}">${escapeHtml(complaintType)}</span></td>
      <td>${escapeHtml(department)}</td>
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
    const byType = {
      sos: reports.filter((report) => report.type === 'sos'),
      complaint: reports.filter((report) => report.type === 'complaint'),
      query: reports.filter((report) => report.type === 'query'),
    };
    const complaintPriorityMap = buildComplaintPriorityMap(byType.complaint);
    const prioritizedComplaints = [...byType.complaint].sort((a, b) => {
      const aType = a.complaintType || 'general';
      const bType = b.complaintType || 'general';
      const aPriority = complaintPriorityMap[aType] || Number.MAX_SAFE_INTEGER;
      const bPriority = complaintPriorityMap[bType] || Number.MAX_SAFE_INTEGER;
      return aPriority - bPriority;
    });

    sosTable.innerHTML = byType.sos.map((report) => rowTemplate(report)).join('') || '<tr><td colspan="10">No SOS cases</td></tr>';
    complaintsTable.innerHTML = prioritizedComplaints
      .map((report) => rowTemplate(report, { complaintPriorityMap }))
      .join('') || '<tr><td colspan="10">No complaints</td></tr>';
    queriesTable.innerHTML = byType.query.map((report) => rowTemplate(report)).join('') || '<tr><td colspan="10">No queries</td></tr>';
  } catch (error) {
    const errorRow = `<tr><td colspan="10">Unable to load dashboard: ${escapeHtml(error.message)}</td></tr>`;
    sosTable.innerHTML = errorRow;
    complaintsTable.innerHTML = errorRow;
    queriesTable.innerHTML = errorRow;
  }
}

window.toggleStatus = async (id) => {
  try {
    await apiFetch(`/api/report/${encodeURIComponent(id)}`, { method: 'PATCH' });
    await loadDashboard();
  } catch (error) {
    const errorRow = `<tr><td colspan="10">Unable to update status: ${escapeHtml(error.message)}</td></tr>`;
    sosTable.innerHTML = errorRow;
    complaintsTable.innerHTML = errorRow;
    queriesTable.innerHTML = errorRow;
  }
};

loadDashboard();
setInterval(loadDashboard, 8000);
