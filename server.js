const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reports.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

const SOS_KEYWORDS = [
  'sos', 'help', 'emergency', 'urgent', 'accident', 'fire', 'attack', 'danger',
  'flood', 'collapse', 'ambulance', 'rescue', 'earthquake'
];

function readReports() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeReports(reports) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2));
}

function isSOSMessage(message = '') {
  const text = message.toLowerCase();

  return SOS_KEYWORDS.some((k) => text.includes(k));
}

function buildChatbotReply(type, citizenName) {
  const name = (citizenName || 'Citizen').trim() || 'Citizen';
  const replies = {
    sos: `⚠️ ${name}, your SOS has been registered. Please stay safe. Emergency response is being escalated.`,
    complaint: `🙏 ${name}, thanks for reporting this complaint. We have logged it and the civic team will review it soon.`,
    query: `💬 ${name}, your query is received. The support team will share an update as soon as possible.`,
  };
  return replies[type] || `✅ ${name}, your request has been recorded.`;
}

function buildAIChatReply(message = '', reports = []) {
  const text = message.toLowerCase();
  const stats = buildStats(reports);

  if (!text.trim()) {
    return 'Hi! Please type your complaint, query, or SOS details and I will guide you.';
  }

  if (isSOSMessage(text)) {
    return 'This sounds urgent. Please press the 🚨 SOS button immediately. Stay in a safe location while help is escalated.';
  }

  if (text.includes('status') || text.includes('pending') || text.includes('resolved')) {
    return `Current cases: Total ${stats.total}, Pending ${stats.pending}, Resolved ${stats.resolved}. Share your case ID for a specific status update.`;
  }

  if (text.includes('complaint')) {
    return 'Please submit your complaint using the form, choose "Complaint", and include location + issue details for faster action.';
  }

  if (text.includes('query') || text.includes('question') || text.includes('how') || text.includes('when')) {
    return 'Please share your query details. I will log it for the support team and they will provide an update.';
  }

  return 'I can help with SOS, complaint submission, and query updates. Tell me what happened and your location.';
}

function buildStats(reports) {
  const stats = {
    total: reports.length,
    sos: 0,
    complaint: 0,
    query: 0,
    resolved: 0,
    pending: 0,
  };

  for (const report of reports) {
    if (stats[report.type] !== undefined) stats[report.type] += 1;
    if (report.status === 'resolved') stats.resolved += 1;
    else stats.pending += 1;
  }

  return stats;
}

function sendJSON(res, code, payload) {
  res.writeHead(code, { 'Content-Type': MIME_TYPES['.json'] });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJSON(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      sendJSON(res, 404, { error: 'Not found' });
      return;
    }

    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');

    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        sendJSON(res, 404, { error: 'File not found' });
        return;
      }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/report') {
    try {
      const body = await parseBody(req);
      const reports = readReports();

      const message = (body.message || '').trim();
      const manualType = body.manualType;
      const isEmergency = isSOSMessage(message);
      let type = null;

      if (manualType && ['sos', 'complaint', 'query'].includes(manualType)) {
        type = manualType;
      } else if (isEmergency) {
        type = 'sos';
      }

      if (!type) {
        sendJSON(res, 400, { error: 'Please select Complaint or Query. System only auto-detects SOS.' });
        return;
      }

      if (!message && type !== 'sos') {
        sendJSON(res, 400, { error: 'Message is required' });
        return;
      }

      const report = {
        id: `CIV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        citizenName: (body.citizenName || 'Anonymous').trim(),
        location: (body.location || 'Not provided').trim(),
        message: message || 'SOS button triggered from Civic AI',
        type,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      reports.unshift(report);
      writeReports(reports);

      const chatbotReply = buildChatbotReply(type, report.citizenName);
      sendJSON(res, 201, {
        success: true,
        report,
        stats: buildStats(reports),
        chatbotReply,
      });
    } catch (error) {
      sendJSON(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/stats') {
    const reports = readReports();
    sendJSON(res, 200, buildStats(reports));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/reports') {
    const reports = readReports();
    sendJSON(res, 200, reports);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      const body = await parseBody(req);
      const reports = readReports();
      const message = (body.message || '').trim();
      const reply = buildAIChatReply(message, reports);
      sendJSON(res, 200, { success: true, reply });
    } catch (error) {
      sendJSON(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH' && req.url.startsWith('/api/report/')) {
    const id = req.url.split('/').pop();
    const reports = readReports();
    const report = reports.find((r) => r.id === id);
    if (!report) {
      sendJSON(res, 404, { error: 'Report not found' });
      return;
    }
    report.status = report.status === 'pending' ? 'resolved' : 'pending';
    writeReports(reports);
    sendJSON(res, 200, { success: true, report, stats: buildStats(reports) });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Civic AI server running on http://localhost:${PORT}`);
});
