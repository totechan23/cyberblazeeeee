const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

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
  'flood', 'collapse', 'ambulance', 'rescue', 'earthquake',
];

const VALID_TYPES = new Set(['sos', 'complaint', 'query']);
const COMPLAINT_KEYWORDS = [
  'complaint', 'issue', 'problem', 'broken', 'damage', 'garbage', 'drainage', 'streetlight',
  'pothole', 'sewage', 'overflow', 'leak', 'waterlogging', 'blocked', 'illegal', 'encroachment',
];
const QUERY_KEYWORDS = [
  'query', 'question', 'clarify', 'information', 'details', 'status', 'update', 'when',
  'where', 'how', 'what', 'why', 'which',
];
const COMPLAINT_ROUTING_RULES = [
  {
    complaintType: 'fire',
    department: 'Fire Department',
    keywords: ['fire', 'smoke', 'burning', 'blaze', 'flame', 'short circuit'],
  },
  {
    complaintType: 'water',
    department: 'Water Department',
    keywords: ['water', 'leak', 'pipeline', 'sewage', 'drainage', 'overflow', 'waterlogging', 'flood'],
  },
  {
    complaintType: 'electricity',
    department: 'Electrical Department',
    keywords: ['electricity', 'power', 'electrical', 'streetlight', 'wire', 'transformer', 'blackout'],
  },
];
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'for', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'it',
  'this', 'that', 'with', 'from', 'my', 'i', 'we', 'you', 'our', 'your', 'be', 'can', 'could', 'should',
  'would', 'how', 'what', 'when', 'where', 'why', 'please', 'about', 'me',
]);

function readReports() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2));
}

function sanitizeText(value, fallback) {
  const clean = String(value || '').trim();
  return clean || fallback;
}

function isSOSMessage(message = '') {
  const text = message.toLowerCase();
  return SOS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function detectReportType(message = '', manualType = '') {
  const normalizedManualType = sanitizeText(manualType, '').toLowerCase();
  if (VALID_TYPES.has(normalizedManualType)) return normalizedManualType;

  const text = sanitizeText(message, '').toLowerCase();
  if (!text) return null;
  if (isSOSMessage(text)) return 'sos';

  const complaintHits = COMPLAINT_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
  const queryHits = QUERY_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
  const hasQuestionMark = text.includes('?');

  if (complaintHits > queryHits) return 'complaint';
  if (queryHits > complaintHits) return 'query';
  if (hasQuestionMark) return 'query';
  return 'complaint';
}

function buildChatbotReply(type, citizenName) {
  const name = (citizenName || 'Citizen').trim() || 'Citizen';
  const replies = {
    sos: `⚠️ ${name}, your SOS has been registered. Please stay safe. Emergency response is being escalated. If life is at immediate risk, call 112 now.`,
    complaint: `🙏 ${name}, thanks for reporting this complaint. We have logged it and the civic team will review it soon.`,
    query: `💬 ${name}, your query is received. The support team will share an update as soon as possible.`,
  };
  return replies[type] || `✅ ${name}, your request has been recorded.`;
}

function detectComplaintRouting(message = '') {
  const text = sanitizeText(message, '').toLowerCase();
  if (!text) return null;

  const matchedRule = COMPLAINT_ROUTING_RULES
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
      return { ...rule, hits };
    })
    .sort((a, b) => b.hits - a.hits)[0];

  if (!matchedRule || matchedRule.hits === 0) {
    return {
      complaintType: 'general',
      department: 'General Complaint Cell',
    };
  }

  return {
    complaintType: matchedRule.complaintType,
    department: matchedRule.department,
  };
}

function tokenize(message) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function summarizeBacklog(stats) {
  if (!stats.total) return 'No reports have been logged yet.';
  const pendingRate = Math.round((stats.pending / Math.max(stats.total, 1)) * 100);
  if (pendingRate > 70) return 'Backlog is high and most reports are still pending.';
  if (pendingRate > 40) return 'Backlog is moderate with a mix of pending and resolved cases.';
  return 'Resolution velocity looks healthy with most items already resolved.';
}

function detectIntent(tokens) {
  const score = {
    emergency: 0,
    complaint: 0,
    query: 0,
    stats: 0,
    guidance: 0,
  };

  const tokenSet = new Set(tokens);
  for (const token of tokenSet) {
    if (['sos', 'emergency', 'urgent', 'danger', 'fire', 'attack', 'accident', 'rescue'].includes(token)) score.emergency += 3;
    if (['complaint', 'issue', 'problem', 'broken', 'garbage', 'drainage', 'streetlight', 'pothole'].includes(token)) score.complaint += 2;
    if (['query', 'question', 'clarify', 'information', 'details', 'update'].includes(token)) score.query += 2;
    if (['stats', 'status', 'reports', 'dashboard', 'summary', 'count'].includes(token)) score.stats += 2;
    if (['help', 'guide', 'steps', 'process', 'how'].includes(token)) score.guidance += 1;
  }

  const top = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 0 ? top[0] : 'guidance';
}

function buildAssistantReply(prompt, reports) {
  const message = sanitizeText(prompt, '');
  const stats = buildStats(reports);
  const tokens = tokenize(message);
  const intent = detectIntent(tokens);

  if (!message) {
    return 'Tell me what you need help with. I can triage emergency situations, guide complaint filing, answer civic queries, and summarize live report trends.';
  }

  if (intent === 'emergency') {
    return 'This sounds urgent. Use 🚨 SOS immediately and include exact location, nearby landmark, injuries/damage, and callback number. If there is immediate risk to life, call 112 right now.';
  }

  if (intent === 'complaint') {
    return 'For a strong complaint, include: (1) exact location, (2) issue type, (3) impact on citizens, and (4) photos/reference details. Submit it as "Complaint" so the civic team can route it to the right department faster.';
  }

  if (intent === 'query') {
    return 'For civic queries, write the context, your exact question, and any case ID. The clearer your query, the faster the department can provide a complete response.';
  }

  if (intent === 'stats') {
    return `Live summary: total ${stats.total}, pending ${stats.pending}, resolved ${stats.resolved}, SOS ${stats.sos}, complaints ${stats.complaint}, queries ${stats.query}. Insight: ${summarizeBacklog(stats)}`;
  }

  return `I can help with SOS escalation, complaint drafting, and query handling. Current system load: ${stats.total} total reports with ${stats.pending} pending. Ask for "stats", "file complaint steps", or "SOS help" for tailored guidance.`;
}

function runPythonDecisionEngine(prompt, reports) {
  const stats = buildStats(reports);
  const payload = JSON.stringify({ prompt: sanitizeText(prompt, ''), stats });
  const aiScriptPath = path.join(__dirname, 'ai_brain.py');

  const result = spawnSync('python3', [aiScriptPath], {
    input: payload,
    encoding: 'utf-8',
    timeout: 3000,
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.error ? result.error.message : `Python AI exited with status ${result.status}`);
  }

  const parsed = JSON.parse(result.stdout || '{}');
  if (!parsed.reply || !parsed.decision) {
    throw new Error('Python AI returned an invalid response');
  }

  return parsed;
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
  const safeUrl = req.url.split('?')[0];
  let filePath = path.join(PUBLIC_DIR, safeUrl === '/' ? 'index.html' : safeUrl);
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

      const message = sanitizeText(body.message, '');
      const manualType = sanitizeText(body.manualType, '').toLowerCase();
      const type = detectReportType(message, manualType);

      if (!type) {
        sendJSON(res, 400, { error: 'Message is required so Civic AI can auto-detect the report type.' });
        return;
      }

      if (!message && type !== 'sos') {
        sendJSON(res, 400, { error: 'Message is required' });
        return;
      }

      const report = {
        id: `CIV-${crypto.randomUUID()}`,
        citizenName: sanitizeText(body.citizenName, 'Anonymous'),
        location: sanitizeText(body.location, 'Not provided'),
        message: message || 'SOS button triggered from Civic AI',
        type,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      if (type === 'complaint') {
        const routing = detectComplaintRouting(message);
        report.complaintType = routing.complaintType;
        report.department = routing.department;
      }

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
      let aiResponse;
      try {
        aiResponse = runPythonDecisionEngine(body.prompt, reports);
      } catch {
        aiResponse = {
          reply: buildAssistantReply(body.prompt, reports),
          decision: {
            intent: 'fallback',
            confidence: 0,
            next_actions: ['local_js_fallback'],
          },
        };
      }
      sendJSON(res, 200, {
        success: true,
        reply: aiResponse.reply,
        decision: aiResponse.decision,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      sendJSON(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH' && req.url.startsWith('/api/report/')) {
    const id = req.url.split('/').pop();
    const reports = readReports();
    const report = reports.find((item) => item.id === id);

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
