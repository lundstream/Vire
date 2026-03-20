const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const db = require('./db');

// --- Load settings ---
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(cors({ origin: false }));
app.use(express.json({ limit: '5mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Session middleware
app.use(session({
  secret: settings.session?.secret || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  name: 'inventory.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    secure: settings.server?.https || false
  }
}));

// Block access to sensitive files
app.use((req, res, next) => {
  const lower = req.path.toLowerCase();
  if (lower.includes('settings.json') || lower.includes('inventory.db') || lower.includes('.env')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// --- Auth middleware ---
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required' });
}

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required' });
  const valid = db.validateApiKey(key);
  if (!valid) return res.status(403).json({ error: 'Invalid API key' });
  next();
}

// =========================================================================
//  AUTH ROUTES
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const user = db.getUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  db.updateLastLogin(user.id);
  req.session.user = { id: user.id, username: user.username, role: user.role };
  const allowedDomains = db.getUserAllowedDomains(user.id);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, allowedDomains } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    const allowedDomains = db.getUserAllowedDomains(req.session.user.id);
    return res.json({ authenticated: true, user: { ...req.session.user, allowedDomains } });
  }
  res.json({ authenticated: false });
});

// =========================================================================
//  ADMIN ROUTES (user/key management)
// =========================================================================
app.get('/api/admin/users', requireLogin, requireAdmin, (req, res) => {
  res.json(db.getUsers());
});

app.post('/api/admin/users', requireLogin, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.getUserByUsername(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const hash = await bcrypt.hash(password, 12);
  db.createUser(username, hash, role || 'viewer');
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireLogin, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.session.user.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.deleteUser(id);
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/password', requireLogin, requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const hash = await bcrypt.hash(password, 12);
  db.updateUserPassword(parseInt(req.params.id, 10), hash);
  res.json({ ok: true });
});

app.get('/api/admin/apikeys', requireLogin, requireAdmin, (req, res) => {
  res.json(db.getApiKeys());
});

app.post('/api/admin/apikeys', requireLogin, requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const raw = db.createApiKey(name);
  res.json({ ok: true, key: raw });
});

app.delete('/api/admin/apikeys/:id', requireLogin, requireAdmin, (req, res) => {
  db.revokeApiKey(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

app.delete('/api/admin/apikeys/:id/purge', requireLogin, requireAdmin, (req, res) => {
  const deleted = db.deleteApiKey(parseInt(req.params.id, 10));
  if (!deleted) return res.status(404).json({ error: 'Key not found or still active' });
  res.json({ ok: true });
});

// =========================================================================
//  INVENTORY POST (API key auth, servers push data here)
// =========================================================================
app.post('/api/inventory', requireApiKey, (req, res) => {
  try {
    const data = req.body;
    if (!data.hostname) return res.status(400).json({ error: 'hostname required' });
    const serverId = db.upsertServer(data);
    res.json({ ok: true, serverId });
  } catch (e) {
    console.error('Inventory POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// =========================================================================
//  HEARTBEAT POST (API key auth, lightweight health check every minute)
// =========================================================================
app.post('/api/heartbeat', requireApiKey, (req, res) => {
  try {
    const data = req.body;
    if (!data.hostname) return res.status(400).json({ error: 'hostname required' });
    const serverId = db.processHeartbeat(data);
    if (!serverId) return res.status(404).json({ error: 'Server not found. Run full inventory first.' });
    res.json({ ok: true, serverId });
  } catch (e) {
    console.error('Heartbeat POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// =========================================================================
//  GPO POST (API key auth, DC pushes GPO data here)
// =========================================================================
app.post('/api/gpo', requireApiKey, (req, res) => {
  try {
    const { domain, gpos } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain required' });
    if (!Array.isArray(gpos)) return res.status(400).json({ error: 'gpos array required' });
    db.upsertDomainGPOs(domain, gpos);
    res.json({ ok: true, count: gpos.length });
  } catch (e) {
    console.error('GPO POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// =========================================================================
//  GPO GET (session auth)
// =========================================================================
app.get('/api/gpo', requireLogin, (req, res) => {
  const domain = req.query.domain || '';
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && allowed.length === 0) return res.json([]);
  if (domain && allowed && !allowed.includes(domain.toUpperCase())) return res.status(403).json({ error: 'No access to this domain' });
  const gpos = db.getDomainGPOs(domain || null);
  if (allowed && !domain) {
    return res.json(gpos.filter(g => allowed.includes(g.domain)));
  }
  res.json(gpos);
});

app.get('/api/gpo/domains', requireLogin, (req, res) => {
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  const domains = db.getGPODomains();
  if (allowed) return res.json(domains.filter(d => allowed.includes(d)));
  res.json(domains);
});

// =========================================================================
//  DNS POST (API key auth — from DC collection script)
// =========================================================================
app.post('/api/dns', requireApiKey, (req, res) => {
  try {
    const { domain, zones } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain required' });
    if (!Array.isArray(zones)) return res.status(400).json({ error: 'zones array required' });
    db.upsertDomainDNS(domain, zones);
    res.json({ ok: true, count: zones.length });
  } catch (e) {
    console.error('DNS POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// =========================================================================
//  DNS GET (session auth)
// =========================================================================
app.get('/api/dns', requireLogin, (req, res) => {
  const domain = req.query.domain || '';
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && allowed.length === 0) return res.json([]);
  if (domain && allowed && !allowed.includes(domain.toUpperCase())) return res.status(403).json({ error: 'No access to this domain' });
  const zones = db.getDomainDNS(domain || null);
  if (allowed && !domain) {
    return res.json(zones.filter(z => allowed.includes(z.domain)));
  }
  res.json(zones);
});

app.get('/api/dns/domains', requireLogin, (req, res) => {
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  const domains = db.getDNSDomains();
  if (allowed) return res.json(domains.filter(d => allowed.includes(d)));
  res.json(domains);
});

// =========================================================================
//  INVENTORY GET (session auth, users view data here)
// =========================================================================
app.get('/api/dashboard/stats', requireLogin, (req, res) => {
  const domain = (req.query.domain || '').trim() || null;
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  // If non-admin with no groups, return empty stats
  if (allowed && allowed.length === 0) return res.json({ total: 0, domains: [], os: {}, rebootPending: 0, missingUpdates: 0, attentionServers: [], domainHealth: {} });
  // If filtering by domain, verify user has access
  if (domain && allowed && !allowed.includes(domain)) return res.status(403).json({ error: 'No access to this domain' });
  res.json(db.getDashboardStats(domain, allowed));
});

app.get('/api/servers', requireLogin, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const sort = (req.query.sort || 'hostname');
  const dir = (req.query.dir || 'ASC');
  const search = (req.query.q || '').trim();
  const domain = (req.query.domain || '').trim();
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && allowed.length === 0) return res.json({ servers: [], total: 0, page, pages: 0 });
  if (domain && allowed && !allowed.includes(domain)) return res.status(403).json({ error: 'No access to this domain' });
  res.json(db.getServers({ page, limit, sort, dir, search, domain, allowedDomains: allowed }));
});

app.get('/api/servers/search', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  res.json(db.searchServers(q));
});

app.get('/api/servers/:hostname', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && !allowed.includes(server.domain_or_workgroup)) return res.status(403).json({ error: 'No access to this domain' });
  const details = db.getServerDetails(server.id);
  res.json({ ...server, ...details });
});

app.get('/api/servers/:hostname/disk-history', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const days = parseInt(req.query.days || '30', 10);
  res.json(db.getDiskHistory(server.id, days));
});

app.get('/api/servers/:hostname/snapshots', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const days = parseInt(req.query.days || '30', 10);
  res.json(db.getServerSnapshots(server.id, days));
});

app.get('/api/servers/:hostname/software', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && !allowed.includes(server.domain_or_workgroup)) return res.status(403).json({ error: 'No access to this domain' });
  res.json(db.getServerSoftware(server.id));
});

app.delete('/api/servers/:hostname', requireLogin, requireAdmin, (req, res) => {
  const deleted = db.deleteServer(req.params.hostname);
  if (!deleted) return res.status(404).json({ error: 'Server not found' });
  res.json({ ok: true });
});

// --- Server Logbook ---
app.get('/api/logbook', requireLogin, (req, res) => {
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500));
  const allowed = db.getUserAllowedDomains(req.session.user.id);
  if (allowed && allowed.length === 0) return res.json([]);
  const entries = db.getAllLogbookEntries(limit);
  if (allowed) {
    return res.json(entries.filter(e => allowed.includes(e.domain_or_workgroup)));
  }
  res.json(entries);
});

app.get('/api/servers/:hostname/logbook', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(db.getLogbookEntries(server.id));
});

app.post('/api/servers/:hostname/logbook', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const comment = (req.body.comment || '').trim();
  if (!comment) return res.status(400).json({ error: 'Comment is required' });
  db.addLogbookEntry(server.id, req.session.user.username, comment);
  res.json({ ok: true });
});

app.delete('/api/servers/:hostname/logbook/:id', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const deleted = db.deleteLogbookEntry(parseInt(req.params.id, 10));
  if (!deleted) return res.status(404).json({ error: 'Entry not found' });
  res.json({ ok: true });
});

// --- Server Maintenance Mode ---
app.post('/api/servers/:hostname/maintenance', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { hours, comment } = req.body;
  const h = parseFloat(hours) || 2;
  const until = new Date(Date.now() + h * 3600000).toISOString();
  db.setMaintenanceMode(server.id, until, (comment || '').trim(), req.session.user.username);
  res.json({ ok: true, until });
});

app.delete('/api/servers/:hostname/maintenance', requireLogin, (req, res) => {
  const server = db.getServer(req.params.hostname);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  db.clearMaintenanceMode(server.id, req.session.user.username);
  res.json({ ok: true });
});

// Maintenance via API key (for PowerShell scripts)
app.post('/api/maintenance', requireApiKey, (req, res) => {
  try {
    const hostname = (req.body.hostname || '').toUpperCase();
    if (!hostname) return res.status(400).json({ error: 'hostname required' });
    const server = db.getServer(hostname);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const h = parseFloat(req.body.hours) || 2;
    const until = new Date(Date.now() + h * 3600000).toISOString();
    const comment = (req.body.comment || '').trim() || 'Maintenance mode set via API';
    const author = req.body.author || 'API';
    db.setMaintenanceMode(server.id, until, comment, author);
    res.json({ ok: true, until });
  } catch (e) {
    console.error('Maintenance POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// =========================================================================
//  GROUPS ROUTES (admin-only CRUD)
// =========================================================================
app.get('/api/admin/groups', requireLogin, requireAdmin, (req, res) => {
  res.json(db.getGroups());
});

app.post('/api/admin/groups', requireLogin, requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Group name required' });
  try {
    const result = db.createGroup(name, (req.body.description || '').trim());
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Group name already exists' });
    throw e;
  }
});

app.put('/api/admin/groups/:id', requireLogin, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Group name required' });
  try {
    db.updateGroup(id, name, (req.body.description || '').trim());
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Group name already exists' });
    throw e;
  }
});

app.delete('/api/admin/groups/:id', requireLogin, requireAdmin, (req, res) => {
  const deleted = db.deleteGroup(parseInt(req.params.id, 10));
  if (!deleted) return res.status(404).json({ error: 'Group not found' });
  res.json({ ok: true });
});

app.put('/api/admin/groups/:id/domains', requireLogin, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const domains = req.body.domains;
  if (!Array.isArray(domains)) return res.status(400).json({ error: 'domains array required' });
  db.setGroupDomains(id, domains);
  res.json({ ok: true });
});

app.post('/api/admin/groups/:id/members', requireLogin, requireAdmin, (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  const userId = parseInt(req.body.userId, 10);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const added = db.addGroupMember(groupId, userId);
  if (!added) return res.status(409).json({ error: 'User already in group' });
  res.json({ ok: true });
});

app.delete('/api/admin/groups/:id/members/:userId', requireLogin, requireAdmin, (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  const removed = db.removeGroupMember(groupId, userId);
  if (!removed) return res.status(404).json({ error: 'Member not found in group' });
  res.json({ ok: true });
});

// =========================================================================
//  CVE HELPERS & POLLING
// =========================================================================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const VENDOR_BLOCKLIST = new Set([
  'chrome-cve-admin','security_alert','security-advisories','security','audit',
  'cna','disclosure','psirt','secure','vulnerabilities','vulnerability','scy',
  'cve-coordination','ics-cert','cybersecurity','infosec','product-security',
  'productsecurity','product-cve','csirt','cert-in','certcc','sirt','prodsec',
  'secalert','secalert_us','responsibledisclosure','vulnreport','reachout',
  'contact','info','support','nvd','nist','zdi-disclosures','cvd','n/a',
  'openclaw','open-emr','oretnom23','fabian','iletisim','gfi','nsasoft',
  'vulncheck','patchstack','wordfence','hackerone','snyk',
  'checkmarx','sonatype','portswigger','acunetix',
  'securin','appcheck','vdiscover','idefense','flexera',
  'veracode','mend','whitesource','incibe','jpcert','kcirt','krcert',
  'mitre','github',
  'the','this','that','shared','with','from','for','and',
  'not','was','has','had','are','were','been','being','have','does',
  'its','all','any','each','every','some','other','another','such',
  'cross-site','improper','missing','multiple','remote','local','use',
  'sql','buffer','stack','heap','integer','null','type','path','file',
  'server','client','user','admin','system','network','web','application'
]);

function extractCvssScore(item) {
  if (!item) return null;
  if (typeof item.cvss === 'number') return item.cvss;
  if (item.cvss && !isNaN(Number(item.cvss))) return Number(item.cvss);
  if (item.cvss3 && item.cvss3.baseScore) return Number(item.cvss3.baseScore);
  try {
    if (item.metrics) {
      const m = item.metrics;
      if (m.cvssMetricV31 && m.cvssMetricV31.length) return Number(m.cvssMetricV31[0].cvssData.baseScore);
      if (m.cvssMetricV40 && m.cvssMetricV40.length) return Number(m.cvssMetricV40[0].cvssData.baseScore);
      if (m.cvssMetricV30 && m.cvssMetricV30.length) return Number(m.cvssMetricV30[0].cvssData.baseScore);
      if (m.cvssMetricV2 && m.cvssMetricV2.length) return Number(m.cvssMetricV2[0].cvssData.baseScore);
    }
  } catch (e) {}
  try {
    const cont = item.containers;
    if (cont) {
      const sources = [].concat(cont.adp || [], cont.cna ? [cont.cna] : []);
      for (const a of sources) {
        if (a.metrics && a.metrics.length) {
          for (const m of a.metrics) {
            if (m.cvssV4_0 && m.cvssV4_0.baseScore) return Number(m.cvssV4_0.baseScore);
            if (m.cvssV3_1 && m.cvssV3_1.baseScore) return Number(m.cvssV3_1.baseScore);
            if (m.cvssV3 && m.cvssV3.baseScore) return Number(m.cvssV3.baseScore);
            if (m.cvssV3_0 && m.cvssV3_0.baseScore) return Number(m.cvssV3_0.baseScore);
          }
        }
      }
    }
  } catch (e) {}
  try {
    if (Array.isArray(item.vulnerabilities)) {
      for (const v of item.vulnerabilities) {
        if (v && Array.isArray(v.scores)) {
          for (const sc of v.scores) {
            if (sc.cvss_v3 && sc.cvss_v3.baseScore) return Number(sc.cvss_v3.baseScore);
            if (sc.cvss_v4 && sc.cvss_v4.baseScore) return Number(sc.cvss_v4.baseScore);
          }
        }
      }
    }
  } catch (e) {}
  const sevText = (item.database_specific && item.database_specific.severity)
    || (item.document && item.document.aggregate_severity && item.document.aggregate_severity.text)
    || '';
  if (sevText) {
    const sev = String(sevText).toUpperCase();
    if (sev === 'CRITICAL') return 9.0;
    if (sev === 'HIGH' || sev === 'IMPORTANT') return 7.5;
    if (sev === 'MEDIUM' || sev === 'MODERATE') return 5.0;
    if (sev === 'LOW') return 2.0;
  }
  return null;
}

function extractItemId(it) {
  if (it.cveMetadata && it.cveMetadata.cveId) return it.cveMetadata.cveId.toUpperCase();
  try {
    if (Array.isArray(it.aliases)) {
      for (const a of it.aliases) {
        const m = String(a).match(/CVE-\d{4}-\d{4,7}/i);
        if (m) return m[0].toUpperCase();
      }
    }
  } catch (_) {}
  try {
    const s = JSON.stringify(it);
    const m = s.match(/CVE-\d{4}-\d{4,7}/i);
    if (m) return m[0].toUpperCase();
  } catch (_) {}
  const raw = it.id || it.CVE || it.cve || '';
  if (raw) {
    const m = String(raw).match(/CVE-\d{4}-\d{4,7}/i);
    if (m) return m[0].toUpperCase();
  }
  return it.id || '';
}

function extractItemDate(it, cveId) {
  const raw = (it.cveMetadata && (it.cveMetadata.datePublished || it.cveMetadata.dateUpdated))
    || it.Published || it.published
    || (it.document && it.document.tracking && (it.document.tracking.current_release_date || it.document.tracking.initial_release_date))
    || null;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  if (cveId) {
    const m = cveId.match(/CVE-(\d{4})/i);
    if (m && Math.abs(d.getFullYear() - parseInt(m[1])) > 2) return null;
  }
  return d;
}

function enrichCveItem(id, item) {
  const enrichment = {};
  try {
    const dateUpdated = item.cveMetadata && item.cveMetadata.dateUpdated;
    const raw = dateUpdated || item.lastModified || null;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) enrichment.discovered = d.toISOString();
    }
  } catch (e) {}
  try {
    function isValidVendor(v) {
      if (!v || v.length <= 2 || v.length > 30) return false;
      if (VENDOR_BLOCKLIST.has(v.toLowerCase())) return false;
      if (/^[0-9a-f-]{20,}$/i.test(v)) return false;
      return true;
    }
    if (item.containers && item.containers.cna && item.containers.cna.affected) {
      const aff = item.containers.cna.affected;
      if (Array.isArray(aff) && aff.length > 0 && aff[0].vendor && isValidVendor(aff[0].vendor)) {
        enrichment.vendor = aff[0].vendor;
      }
    }
    if (!enrichment.vendor && item.configurations) {
      const configs = Array.isArray(item.configurations) ? item.configurations : [item.configurations];
      outer:
      for (const cfg of configs) {
        const nodes = cfg.nodes || (cfg.cpeMatch ? [cfg] : []);
        for (const node of nodes) {
          const matches = node.cpeMatch || [];
          for (const m of matches) {
            if (m.criteria) {
              const parts = m.criteria.split(':');
              if (parts.length > 3 && parts[3] && parts[3] !== '*' && isValidVendor(parts[3])) {
                enrichment.vendor = parts[3];
                break outer;
              }
            }
          }
        }
      }
    }
    if (!enrichment.vendor && item.product_tree && item.product_tree.branches) {
      csafOuter:
      for (const branch of item.product_tree.branches) {
        const stack = [branch];
        while (stack.length) {
          const node = stack.pop();
          const cpe = node.product && node.product.product_identification_helper && node.product.product_identification_helper.cpe;
          if (cpe) {
            const parts = cpe.replace('cpe:/', 'cpe:2.3:').split(':');
            if (parts.length > 3 && parts[3] && parts[3] !== '*' && isValidVendor(parts[3])) {
              enrichment.vendor = parts[3];
              break csafOuter;
            }
          }
          if (Array.isArray(node.branches)) {
            for (const child of node.branches) stack.push(child);
          }
        }
      }
    }
  } catch (e) {}
  try {
    let refs = [];
    if (Array.isArray(item.references)) refs = refs.concat(item.references);
    if (item.containers && item.containers.cna && Array.isArray(item.containers.cna.references)) {
      refs = refs.concat(item.containers.cna.references);
    }
    let hasExploit = false;
    let hasPatch = false;
    for (const ref of refs) {
      const tags = ref.tags || [];
      const url = (ref.url || '').toLowerCase();
      for (const tag of tags) {
        const t = String(tag).toLowerCase();
        if (t === 'exploit' || t.includes('exploit')) hasExploit = true;
        if (t === 'patch' || t.includes('patch')) hasPatch = true;
      }
      if (url.includes('exploit-db.com') || url.includes('packetstorm') || url.includes('/poc') || url.includes('proof-of-concept')) hasExploit = true;
      if (url.includes('/patch') || url.includes('/fix') || url.includes('/advisory') || url.includes('security-update')) hasPatch = true;
    }
    enrichment.has_exploit = hasExploit;
    enrichment.has_patch = hasPatch;
  } catch (e) {}
  return enrichment;
}

async function pollCves() {
  try {
    const cveSettings = settings.cve || {};
    const fetchCount = cveSettings.fetchCount || 300;
    const url = `${cveSettings.circlLastUrl || 'https://cve.circl.lu/api/last'}/${fetchCount}`;
    const r = await fetch(url);
    let data = await r.json();
    if (!Array.isArray(data)) {
      if (data && Array.isArray(data.value)) data = data.value;
      else { console.error('pollCves: unexpected response'); return; }
    }
    let added = 0;
    for (const it of data) {
      const id = extractItemId(it);
      if (!id) continue;
      const d = extractItemDate(it, id);
      const published = d ? d.toISOString() : null;
      const enrichment = enrichCveItem(id, it);
      db.upsertCve(id, it, published, extractCvssScore(it), enrichment);
      added++;
    }
    const maxAge = cveSettings.maxAgeDays || 120;
    const purged = db.purgeCves(maxAge);
    const total = db.getCveCount();
    console.log(`pollCves: fetched ${data.length}, upserted ${added}, purged ${purged}, total ${total}`);
  } catch (e) {
    console.error('pollCves error:', e && e.message);
  }
}

// =========================================================================
//  SECURITY POSTURE API ROUTES
// =========================================================================
app.get('/api/security/summary', requireLogin, (req, res) => {
  const allowedDomains = req.session.user.role === 'admin' ? null : db.getUserAllowedDomains(req.session.user.id);
  res.json(db.getSecuritySummary(allowedDomains));
});

app.get('/api/security/posture', requireLogin, (req, res) => {
  const allowedDomains = req.session.user.role === 'admin' ? null : db.getUserAllowedDomains(req.session.user.id);
  res.json(db.getSecurityPosture(allowedDomains));
});

app.get('/api/security/server-cves', requireLogin, (req, res) => {
  const products = req.query.products;
  if (!products) return res.json([]);
  const list = Array.isArray(products) ? products : products.split(',');
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  res.json(db.getMatchingCves(list, limit));
});

// =========================================================================
//  CVE API ROUTES
// =========================================================================
app.get('/api/cves', requireLogin, (req, res) => {
  const count = Math.min(parseInt(req.query.count || '50', 10), 200);
  const offset = parseInt(req.query.offset || '0', 10);
  const cvssMin = req.query.cvssMin ? parseFloat(req.query.cvssMin) : null;
  res.json(db.getCves(count, offset, cvssMin));
});

app.get('/api/cves/search', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  try {
    res.json(db.searchCves(q, limit));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/cves/risk', requireLogin, (req, res) => {
  const count = Math.min(parseInt(req.query.count || '15', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const maxAge = Math.min(parseInt(req.query.maxAge || '90', 10), 365);
  const rawVendor = req.query.vendor;
  let vendor = null;
  if (rawVendor) {
    const arr = Array.isArray(rawVendor) ? rawVendor : [rawVendor];
    const filtered = arr.filter(v => v && v !== 'all');
    if (filtered.length) vendor = filtered;
  }
  res.json(db.getHighRiskCves(count, offset, maxAge, vendor));
});

app.get('/api/cves/vendors', requireLogin, (req, res) => {
  const maxAge = Math.min(parseInt(req.query.maxAge || '90', 10), 365);
  const rawVendor = req.query.vendor;
  let vendors = null;
  if (rawVendor) {
    const arr = Array.isArray(rawVendor) ? rawVendor : [rawVendor];
    const filtered = arr.filter(v => v && v !== 'all');
    if (filtered.length) vendors = filtered;
  }
  res.json(db.getCveVendorStats(maxAge, vendors));
});

app.get('/api/cves/count', requireLogin, (req, res) => {
  res.json({ count: db.getCveCount() });
});

app.get('/api/cve/:id', requireLogin, async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing id' });
  try {
    const cveSettings = settings.cve || {};
    const baseUrl = cveSettings.circlCveUrl || 'https://cve.circl.lu/api/cve';
    const r = await fetch(`${baseUrl}/${encodeURIComponent(id)}`);
    if (!r.ok) return res.status(r.status).json({ error: 'fetch failed' });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================================================================
//  STATIC FILES (serve after API routes, require login for HTML)
// =========================================================================
// Login page is always accessible
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve static assets (CSS, JS, fonts) without auth
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// All other static files require login (redirect to login page)
app.use((req, res, next) => {
  // Allow API routes through
  if (req.path.startsWith('/api/')) return next();
  // Allow login page
  if (req.path === '/login.html') return next();
  // Check session
  if (!req.session || !req.session.user) {
    // For HTML requests, redirect to login
    if (req.accepts('html')) {
      return res.redirect('/login.html');
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// SPA fallback — serve index.html for unmatched routes (after login check)
app.get('{*path}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  if (!req.session || !req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================================
//  STARTUP
// =========================================================================
async function bootstrap() {
  db.getDb(); // init database

  // Create default admin user if none exists
  const users = db.getUsers();
  if (users.length === 0) {
    const defaultPassword = settings.defaultAdminPassword || 'ChangeMe123!';
    const hash = await bcrypt.hash(defaultPassword, 12);
    db.createUser('admin', hash, 'admin');
    console.log(`Created default admin user (username: admin, password: ${defaultPassword})`);
    console.log('!! CHANGE THE DEFAULT PASSWORD IMMEDIATELY !!');
  }

  // Purge old history data daily
  setInterval(() => {
    db.purgeHistory(settings.historyRetentionDays || 90);
  }, 24 * 60 * 60 * 1000);

  // Initial CVE poll + scheduled interval
  const cveSettings = settings.cve || {};
  const cveInterval = (cveSettings.pollIntervalMinutes || 10) * 60 * 1000;
  console.log('Polling CVEs...');
  pollCves();
  setInterval(pollCves, cveInterval);

  const PORT = settings.server?.port || 3000;
  app.listen(PORT, () => {
    console.log(`Inventory Web listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
