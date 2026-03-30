const statsGrid = document.getElementById('statsGrid');
const reportsTable = document.getElementById('reportsTable');

function renderStats(stats) {
  const labels = ['total', 'sos', 'complaint', 'query', 'pending', 'resolved'];
  statsGrid.innerHTML = labels
    .map((key) => `<div class="stat"><h3>${key.toUpperCase()}</h3><p>${stats[key] || 0}</p></div>`)
    .join('');
}

function rowTemplate(report) {
  return `
    <tr>
      <td>${report.id}</td>
      <td><span class="tag ${report.type}">${report.type}</span></td>
      <td>${report.citizenName}</td>
      <td>${report.location}</td>
      <td>${report.message}</td>
      <td><span class="tag ${report.status}">${report.status}</span></td>
      <td><button class="btn" onclick="toggleStatus('${report.id}')">Toggle</button></td>
    </tr>
  `;
}

async function loadDashboard() {
  const [statsRes, reportsRes] = await Promise.all([
    fetch('/api/stats'),
    fetch('/api/reports')
  ]);

  const stats = await statsRes.json();
  const reports = await reportsRes.json();

  renderStats(stats);
  reportsTable.innerHTML = reports.map(rowTemplate).join('') || '<tr><td colspan="7">No cases yet</td></tr>';
}

window.toggleStatus = async (id) => {
  await fetch(`/api/report/${id}`, { method: 'PATCH' });
  loadDashboard();
};

loadDashboard();
setInterval(loadDashboard, 8000);
