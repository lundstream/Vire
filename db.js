const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

let _db;

function getDb() {
  if (_db) return _db;
  const dbPath = path.join(__dirname, 'data', 'inventory.db');
  const fs = require('fs');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema();
  return _db;
}

function initSchema() {
  const d = _db;

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used TEXT,
      active INTEGER DEFAULT 1
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostname TEXT UNIQUE NOT NULL,
      fqdn TEXT,
      domain_or_workgroup TEXT,
      domain_type TEXT,
      ou TEXT,
      os_edition TEXT,
      os_version TEXT,
      os_build TEXT,
      install_date TEXT,
      last_boot TEXT,
      activation_status TEXT,
      is_virtual INTEGER,
      hypervisor TEXT,
      cpu_model TEXT,
      cpu_cores INTEGER,
      cpu_usage REAL,
      ram_total_gb REAL,
      ram_used_gb REAL,
      last_patch_date TEXT,
      missing_critical_updates INTEGER DEFAULT 0,
      wsus_server TEXT,
      reboot_pending INTEGER DEFAULT 0,
      antivirus_product TEXT,
      antivirus_status TEXT,
      bitlocker_status TEXT,
      rdp_enabled INTEGER,
      nla_enabled INTEGER,
      last_admin_login TEXT,
      last_user_login TEXT,
      last_security_scan TEXT,
      critical_events_24h INTEGER DEFAULT 0,
      cluster_health TEXT,
      replication_health TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      first_seen TEXT DEFAULT (datetime('now'))
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_ip_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      adapter_name TEXT,
      ip_address TEXT,
      subnet_mask TEXT,
      mac_address TEXT,
      speed_mbps INTEGER,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_disks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      drive_letter TEXT,
      volume_label TEXT,
      size_gb REAL,
      free_gb REAL,
      file_system TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT,
      type TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT,
      display_name TEXT,
      status TEXT,
      start_type TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_local_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      account_name TEXT,
      account_type TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_missing_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      kb_id TEXT,
      title TEXT,
      severity TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_event_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      log_name TEXT,
      event_id INTEGER,
      source TEXT,
      message TEXT,
      time_created TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_firewall_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT,
      direction TEXT,
      action TEXT,
      protocol TEXT,
      local_port TEXT,
      remote_port TEXT,
      remote_address TEXT,
      enabled INTEGER,
      profile TEXT,
      rule_source TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_gpos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      gpo_name TEXT,
      gpo_status TEXT,
      gpo_guid TEXT,
      link_order INTEGER,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_local_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      category TEXT,
      policy_name TEXT,
      setting TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS disk_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      drive_letter TEXT,
      size_gb REAL,
      free_gb REAL,
      recorded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS server_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      cpu_usage REAL,
      ram_used_gb REAL,
      recorded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  // Indexes
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_servers_hostname ON servers(hostname);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_disk_history_server ON disk_history(server_id, recorded_at);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_server ON server_snapshots(server_id, recorded_at);`); } catch(e){}

  // Child table indexes
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_disks_server ON server_disks(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_ips_server ON server_ip_addresses(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_roles_server ON server_roles(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_services_server ON server_services(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_admins_server ON server_local_admins(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_updates_server ON server_missing_updates(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_events_server ON server_event_errors(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_firewall_server ON server_firewall_rules(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_gpos_server ON server_gpos(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_policies_server ON server_local_policies(server_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_gpo_links ON domain_gpo_links(gpo_id);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_gpo_settings ON domain_gpo_settings(gpo_id);`); } catch(e){}

  // Domain-level GPO tables
  d.exec(`
    CREATE TABLE IF NOT EXISTS domain_gpos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      gpo_name TEXT NOT NULL,
      gpo_guid TEXT,
      gpo_status TEXT,
      creation_time TEXT,
      modification_time TEXT,
      wmi_filter TEXT,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(domain, gpo_guid)
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS domain_gpo_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpo_id INTEGER NOT NULL,
      target TEXT,
      link_enabled INTEGER DEFAULT 1,
      enforced INTEGER DEFAULT 0,
      link_order INTEGER,
      FOREIGN KEY (gpo_id) REFERENCES domain_gpos(id) ON DELETE CASCADE
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS domain_gpo_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpo_id INTEGER NOT NULL,
      area TEXT,
      category TEXT,
      setting_name TEXT,
      setting_value TEXT,
      FOREIGN KEY (gpo_id) REFERENCES domain_gpos(id) ON DELETE CASCADE
    );
  `);

  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_domain_gpos_domain ON domain_gpos(domain);`); } catch(e){}

  // Domain-level DNS tables
  d.exec(`
    CREATE TABLE IF NOT EXISTS domain_dns_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      zone_name TEXT NOT NULL,
      zone_type TEXT,
      is_reverse_lookup INTEGER DEFAULT 0,
      is_ad_integrated INTEGER DEFAULT 0,
      dynamic_update TEXT,
      aging_enabled INTEGER DEFAULT 0,
      record_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(domain, zone_name)
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS domain_dns_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      record_name TEXT,
      record_type TEXT,
      record_data TEXT,
      ttl TEXT,
      FOREIGN KEY (zone_id) REFERENCES domain_dns_zones(id) ON DELETE CASCADE
    );
  `);

  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_domain_dns_zones_domain ON domain_dns_zones(domain);`); } catch(e){}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_dns_records_zone ON domain_dns_records(zone_id);`); } catch(e){}

  // Logbook comments
  d.exec(`
    CREATE TABLE IF NOT EXISTS server_logbook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_logbook_server ON server_logbook(server_id, created_at);`); } catch(e){}

  // Purge legacy maintenance auto-entries from logbook
  d.exec(`DELETE FROM server_logbook WHERE comment LIKE '%Maintenance started%' OR comment LIKE '%Maintenance ended%'`);

  // Migrations — add columns if missing
  try { d.exec(`ALTER TABLE servers ADD COLUMN nla_enabled INTEGER;`); } catch(e){}
  try { d.exec(`ALTER TABLE server_firewall_rules ADD COLUMN rule_source TEXT;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN maintenance_mode INTEGER DEFAULT 0;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN maintenance_until TEXT;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN maintenance_comment TEXT;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN maintenance_set_by TEXT;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN last_heartbeat TEXT;`); } catch(e){}
  try { d.exec(`ALTER TABLE servers ADD COLUMN stopped_services INTEGER DEFAULT 0;`); } catch(e){}

  // --- Permission Groups ---
  d.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS group_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      UNIQUE(group_id, domain)
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );
  `);

  try { d.exec('CREATE INDEX IF NOT EXISTS idx_group_domains_group ON group_domains(group_id);'); } catch(e){}
  try { d.exec('CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);'); } catch(e){}
  try { d.exec('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);'); } catch(e){}
}

// --- Users ---
function createUser(username, passwordHash, role) {
  const d = getDb();
  return d.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role || 'viewer');
}

function getUserByUsername(username) {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function updateLastLogin(userId) {
  const d = getDb();
  d.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
}

function getUsers() {
  const d = getDb();
  return d.prepare('SELECT id, username, role, created_at, last_login FROM users').all();
}

function deleteUser(userId) {
  const d = getDb();
  d.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

function updateUserPassword(userId, passwordHash) {
  const d = getDb();
  d.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

// --- API Keys ---
function createApiKey(name) {
  const d = getDb();
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  d.prepare('INSERT INTO api_keys (key_hash, name) VALUES (?, ?)').run(hash, name);
  return raw;
}

function validateApiKey(raw) {
  const d = getDb();
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const row = d.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').get(hash);
  if (row) {
    d.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(row.id);
  }
  return row || null;
}

function getApiKeys() {
  const d = getDb();
  return d.prepare('SELECT id, name, created_at, last_used, active FROM api_keys').all();
}

function revokeApiKey(keyId) {
  const d = getDb();
  d.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(keyId);
}

function deleteApiKey(keyId) {
  const d = getDb();
  return d.prepare('DELETE FROM api_keys WHERE id = ? AND active = 0').run(keyId).changes > 0;
}

// --- Servers ---
function upsertServer(data) {
  const d = getDb();
  const hostname = (data.hostname || '').toUpperCase();
  if (!hostname) return null;

  const existing = d.prepare('SELECT id FROM servers WHERE hostname = ?').get(hostname);

  if (existing) {
    d.prepare(`UPDATE servers SET
      fqdn = ?, domain_or_workgroup = ?, domain_type = ?, ou = ?,
      os_edition = ?, os_version = ?, os_build = ?,
      install_date = ?, last_boot = ?, activation_status = ?,
      is_virtual = ?, hypervisor = ?,
      cpu_model = ?, cpu_cores = ?, cpu_usage = ?,
      ram_total_gb = ?, ram_used_gb = ?,
      last_patch_date = ?, missing_critical_updates = ?,
      wsus_server = ?, reboot_pending = ?,
      antivirus_product = ?, antivirus_status = ?,
      bitlocker_status = ?, rdp_enabled = ?, nla_enabled = ?,
      last_admin_login = ?, last_user_login = ?,
      last_security_scan = ?, critical_events_24h = ?,
      cluster_health = ?, replication_health = ?,
      updated_at = datetime('now')
    WHERE hostname = ?`).run(
      data.fqdn || null, data.domain_or_workgroup || null, data.domain_type || null, data.ou || null,
      data.os_edition || null, data.os_version || null, data.os_build || null,
      data.install_date || null, data.last_boot || null, data.activation_status || null,
      data.is_virtual ? 1 : 0, data.hypervisor || null,
      data.cpu_model || null, data.cpu_cores || null, data.cpu_usage || null,
      data.ram_total_gb || null, data.ram_used_gb || null,
      data.last_patch_date || null, data.missing_critical_updates || 0,
      data.wsus_server || null, data.reboot_pending ? 1 : 0,
      data.antivirus_product || null, data.antivirus_status || null,
      data.bitlocker_status || null, data.rdp_enabled ? 1 : 0, data.nla_enabled != null ? (data.nla_enabled ? 1 : 0) : null,
      data.last_admin_login || null, data.last_user_login || null,
      data.last_security_scan || null, data.critical_events_24h || 0,
      data.cluster_health || null, data.replication_health || null,
      hostname
    );

    const serverId = existing.id;
    replaceChildData(serverId, data);
    recordHistory(serverId, data);
    return serverId;
  } else {
    const result = d.prepare(`INSERT INTO servers (
      hostname, fqdn, domain_or_workgroup, domain_type, ou,
      os_edition, os_version, os_build,
      install_date, last_boot, activation_status,
      is_virtual, hypervisor,
      cpu_model, cpu_cores, cpu_usage,
      ram_total_gb, ram_used_gb,
      last_patch_date, missing_critical_updates,
      wsus_server, reboot_pending,
      antivirus_product, antivirus_status,
      bitlocker_status, rdp_enabled, nla_enabled,
      last_admin_login, last_user_login,
      last_security_scan, critical_events_24h,
      cluster_health, replication_health
    ) VALUES (${Array(33).fill('?').join(',')})`).run(
      hostname, data.fqdn || null, data.domain_or_workgroup || null, data.domain_type || null, data.ou || null,
      data.os_edition || null, data.os_version || null, data.os_build || null,
      data.install_date || null, data.last_boot || null, data.activation_status || null,
      data.is_virtual ? 1 : 0, data.hypervisor || null,
      data.cpu_model || null, data.cpu_cores || null, data.cpu_usage || null,
      data.ram_total_gb || null, data.ram_used_gb || null,
      data.last_patch_date || null, data.missing_critical_updates || 0,
      data.wsus_server || null, data.reboot_pending ? 1 : 0,
      data.antivirus_product || null, data.antivirus_status || null,
      data.bitlocker_status || null, data.rdp_enabled ? 1 : 0, data.nla_enabled != null ? (data.nla_enabled ? 1 : 0) : null,
      data.last_admin_login || null, data.last_user_login || null,
      data.last_security_scan || null, data.critical_events_24h || 0,
      data.cluster_health || null, data.replication_health || null
    );

    const serverId = result.lastInsertRowid;
    replaceChildData(serverId, data);
    recordHistory(serverId, data);
    return serverId;
  }
}

function replaceChildData(serverId, data) {
  const d = getDb();

  // IP addresses / network adapters
  d.prepare('DELETE FROM server_ip_addresses WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.ip_addresses)) {
    const ins = d.prepare('INSERT INTO server_ip_addresses (server_id, adapter_name, ip_address, subnet_mask, mac_address, speed_mbps) VALUES (?,?,?,?,?,?)');
    for (const ip of data.ip_addresses) {
      ins.run(serverId, ip.adapter_name || null, ip.ip_address || null, ip.subnet_mask || null, ip.mac_address || null, ip.speed_mbps || null);
    }
  }

  // Disks
  d.prepare('DELETE FROM server_disks WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.disks)) {
    const ins = d.prepare('INSERT INTO server_disks (server_id, drive_letter, volume_label, size_gb, free_gb, file_system) VALUES (?,?,?,?,?,?)');
    for (const disk of data.disks) {
      ins.run(serverId, disk.drive_letter || null, disk.volume_label || null, disk.size_gb || null, disk.free_gb || null, disk.file_system || null);
    }
  }

  // Roles/features
  d.prepare('DELETE FROM server_roles WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.roles)) {
    const ins = d.prepare('INSERT INTO server_roles (server_id, name, type) VALUES (?,?,?)');
    for (const r of data.roles) {
      ins.run(serverId, r.name || null, r.type || null);
    }
  }

  // Services
  d.prepare('DELETE FROM server_services WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.services)) {
    const ins = d.prepare('INSERT INTO server_services (server_id, name, display_name, status, start_type) VALUES (?,?,?,?,?)');
    for (const s of data.services) {
      ins.run(serverId, s.name || null, s.display_name || null, s.status || null, s.start_type || null);
    }
  }

  // Local admins
  d.prepare('DELETE FROM server_local_admins WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.local_admins)) {
    const ins = d.prepare('INSERT INTO server_local_admins (server_id, account_name, account_type) VALUES (?,?,?)');
    for (const a of data.local_admins) {
      ins.run(serverId, a.account_name || null, a.account_type || null);
    }
  }

  // Missing updates
  d.prepare('DELETE FROM server_missing_updates WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.missing_updates)) {
    const ins = d.prepare('INSERT INTO server_missing_updates (server_id, kb_id, title, severity) VALUES (?,?,?,?)');
    for (const u of data.missing_updates) {
      ins.run(serverId, u.kb_id || null, u.title || null, u.severity || null);
    }
  }

  // Event errors
  d.prepare('DELETE FROM server_event_errors WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.event_errors)) {
    const ins = d.prepare('INSERT INTO server_event_errors (server_id, log_name, event_id, source, message, time_created) VALUES (?,?,?,?,?,?)');
    for (const e of data.event_errors) {
      ins.run(serverId, e.log_name || null, e.event_id || null, e.source || null, e.message || null, e.time_created || null);
    }
  }

  // Firewall rules
  d.prepare('DELETE FROM server_firewall_rules WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.firewall_rules)) {
    const ins = d.prepare('INSERT INTO server_firewall_rules (server_id, name, direction, action, protocol, local_port, remote_port, remote_address, enabled, profile, rule_source) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    for (const f of data.firewall_rules) {
      ins.run(serverId, f.name || null, f.direction || null, f.action || null, f.protocol || null, f.local_port || null, f.remote_port || null, f.remote_address || null, f.enabled ? 1 : 0, f.profile || null, f.rule_source || null);
    }
  }

  // GPOs
  d.prepare('DELETE FROM server_gpos WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.gpos)) {
    const ins = d.prepare('INSERT INTO server_gpos (server_id, gpo_name, gpo_status, gpo_guid, link_order) VALUES (?,?,?,?,?)');
    for (const g of data.gpos) {
      ins.run(serverId, g.gpo_name || null, g.gpo_status || null, g.gpo_guid || null, g.link_order || null);
    }
  }

  // Local policies
  d.prepare('DELETE FROM server_local_policies WHERE server_id = ?').run(serverId);
  if (Array.isArray(data.local_policies)) {
    const ins = d.prepare('INSERT INTO server_local_policies (server_id, category, policy_name, setting) VALUES (?,?,?,?)');
    for (const p of data.local_policies) {
      ins.run(serverId, p.category || null, p.policy_name || null, p.setting || null);
    }
  }
}

function recordHistory(serverId, data) {
  const d = getDb();

  // Disk history
  if (Array.isArray(data.disks)) {
    const ins = d.prepare('INSERT INTO disk_history (server_id, drive_letter, size_gb, free_gb) VALUES (?,?,?,?)');
    for (const disk of data.disks) {
      ins.run(serverId, disk.drive_letter || null, disk.size_gb || null, disk.free_gb || null);
    }
  }

  // CPU/RAM snapshot
  d.prepare('INSERT INTO server_snapshots (server_id, cpu_usage, ram_used_gb) VALUES (?,?,?)').run(
    serverId, data.cpu_usage || null, data.ram_used_gb || null
  );
}

function getServers(options) {
  const d = getDb();
  const { sort = 'hostname', dir = 'ASC', page = 1, limit = 100, search = '', domain = '', allowedDomains = null } = options || {};

  // Whitelist sortable columns
  const sortCols = { hostname: 'hostname', os_edition: 'os_edition', cpu_usage: 'cpu_usage', ram_used_gb: 'ram_used_gb', missing_critical_updates: 'missing_critical_updates', antivirus_status: 'antivirus_status', reboot_pending: 'reboot_pending', updated_at: 'updated_at', domain_or_workgroup: 'domain_or_workgroup', is_virtual: 'is_virtual', last_heartbeat: 'last_heartbeat' };
  const sortCol = sortCols[sort] || 'hostname';
  const sortDir = dir === 'DESC' ? 'DESC' : 'ASC';
  const offset = (Math.max(1, page) - 1) * limit;

  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (hostname LIKE ? OR fqdn LIKE ? OR os_edition LIKE ? OR domain_or_workgroup LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (domain) {
    where += ' AND domain_or_workgroup = ?';
    params.push(domain.toUpperCase());
  }
  // Domain-level permission filtering (non-admin users)
  if (allowedDomains && allowedDomains.length > 0) {
    where += ` AND domain_or_workgroup IN (${allowedDomains.map(() => '?').join(',')})`;
    params.push(...allowedDomains);
  }

  const total = d.prepare(`SELECT COUNT(*) as c FROM servers WHERE ${where}`).get(...params).c;
  const rows = d.prepare(`SELECT * FROM servers WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const totalPages = Math.ceil(total / limit);

  return { data: rows, total, page, totalPages, limit };
}

function getServer(hostname) {
  const d = getDb();
  return d.prepare('SELECT * FROM servers WHERE hostname = ?').get((hostname || '').toUpperCase());
}

function getServerById(id) {
  const d = getDb();
  return d.prepare('SELECT * FROM servers WHERE id = ?').get(id);
}

function getServerDetails(serverId) {
  const d = getDb();
  return {
    ip_addresses: d.prepare('SELECT * FROM server_ip_addresses WHERE server_id = ?').all(serverId),
    disks: d.prepare('SELECT * FROM server_disks WHERE server_id = ?').all(serverId),
    roles: d.prepare('SELECT * FROM server_roles WHERE server_id = ?').all(serverId),
    services: d.prepare('SELECT * FROM server_services WHERE server_id = ?').all(serverId),
    local_admins: d.prepare('SELECT * FROM server_local_admins WHERE server_id = ?').all(serverId),
    missing_updates: d.prepare('SELECT * FROM server_missing_updates WHERE server_id = ?').all(serverId),
    event_errors: d.prepare('SELECT * FROM server_event_errors WHERE server_id = ?').all(serverId),
    firewall_rules: d.prepare('SELECT * FROM server_firewall_rules WHERE server_id = ?').all(serverId),
    gpos: d.prepare('SELECT * FROM server_gpos WHERE server_id = ?').all(serverId),
    local_policies: d.prepare('SELECT * FROM server_local_policies WHERE server_id = ?').all(serverId),
  };
}

function getDiskHistory(serverId, days) {
  const d = getDb();
  return d.prepare(`SELECT * FROM disk_history WHERE server_id = ? AND recorded_at >= datetime('now', '-' || ? || ' days') ORDER BY recorded_at`).all(serverId, days || 30);
}

function getServerSnapshots(serverId, days) {
  const d = getDb();
  return d.prepare(`SELECT * FROM server_snapshots WHERE server_id = ? AND recorded_at >= datetime('now', '-' || ? || ' days') ORDER BY recorded_at`).all(serverId, days || 30);
}

function deleteServer(hostname) {
  const d = getDb();
  const server = d.prepare('SELECT id FROM servers WHERE hostname = ?').get((hostname || '').toUpperCase());
  if (!server) return false;
  d.prepare('DELETE FROM servers WHERE id = ?').run(server.id);
  return true;
}

function getServerCount() {
  const d = getDb();
  return d.prepare('SELECT COUNT(*) as count FROM servers').get().count;
}

function getDashboardStats(domain, allowedDomains) {
  const d = getDb();
  // Build domain filter: specific domain or allowed domains list
  let domainFilter = '';
  let domainFilterS = '';
  let domainParams = [];
  let w = '';
  if (domain) {
    domainFilter = ' AND domain_or_workgroup = ?';
    domainFilterS = ' AND s.domain_or_workgroup = ?';
    domainParams = [domain.toUpperCase()];
    w = ' WHERE domain_or_workgroup = ?';
  } else if (allowedDomains && allowedDomains.length > 0) {
    const placeholders = allowedDomains.map(() => '?').join(',');
    domainFilter = ` AND domain_or_workgroup IN (${placeholders})`;
    domainFilterS = ` AND s.domain_or_workgroup IN (${placeholders})`;
    domainParams = [...allowedDomains];
    w = ` WHERE domain_or_workgroup IN (${placeholders})`;
  }
  const total = d.prepare('SELECT COUNT(*) as c FROM servers' + w).get(...domainParams).c;
  const virtual = d.prepare('SELECT COUNT(*) as c FROM servers WHERE is_virtual = 1' + domainFilter).get(...domainParams).c;
  const physical = total - virtual;
  const rebootPending = d.prepare('SELECT COUNT(*) as c FROM servers WHERE reboot_pending = 1' + domainFilter).get(...domainParams).c;
  const missingUpdates = d.prepare('SELECT COUNT(*) as c FROM servers WHERE missing_critical_updates > 0' + domainFilter).get(...domainParams).c;
  const rdpEnabled = d.prepare('SELECT COUNT(*) as c FROM servers WHERE rdp_enabled = 1 AND (nla_enabled = 0 OR nla_enabled IS NULL)' + domainFilter).get(...domainParams).c;
  const criticalEvents = d.prepare('SELECT COUNT(*) as c FROM servers WHERE critical_events_24h > 0' + domainFilter).get(...domainParams).c;
  const staleServers = d.prepare("SELECT COUNT(*) as c FROM servers WHERE updated_at < datetime('now', '-7 days')" + domainFilter).get(...domainParams).c;
  const inMaintenance = d.prepare("SELECT COUNT(*) as c FROM servers WHERE maintenance_mode = 1 AND maintenance_until > datetime('now')" + domainFilter).get(...domainParams).c;
  const online = d.prepare("SELECT COUNT(*) as c FROM servers WHERE last_heartbeat >= datetime('now', '-3 minutes')" + domainFilter).get(...domainParams).c;
  const offline = d.prepare("SELECT COUNT(*) as c FROM servers WHERE last_heartbeat IS NOT NULL AND last_heartbeat < datetime('now', '-3 minutes')" + domainFilter).get(...domainParams).c;
  const neverReported = d.prepare("SELECT COUNT(*) as c FROM servers WHERE last_heartbeat IS NULL" + domainFilter).get(...domainParams).c;
  const serviceIssues = d.prepare("SELECT COUNT(*) as c FROM servers WHERE stopped_services > 0" + domainFilter).get(...domainParams).c;

  // Disk space warnings: <10% or <10GB free = warning, <5% or <5GB free = critical
  const diskRows = d.prepare(`SELECT s.hostname, s.domain_or_workgroup, sd.drive_letter, sd.size_gb, sd.free_gb
    FROM server_disks sd JOIN servers s ON sd.server_id = s.id
    WHERE sd.size_gb > 0 AND LOWER(COALESCE(sd.volume_label, '')) != 'system reserved'` + domainFilterS).all(...domainParams);
  const diskWarnServers = new Set();
  const diskCritServers = new Set();
  const diskAlerts = [];
  for (const dr of diskRows) {
    const pct = (dr.free_gb / dr.size_gb) * 100;
    if (pct < 5 || dr.free_gb < 5) {
      diskCritServers.add(dr.hostname);
      diskAlerts.push({ hostname: dr.hostname, domain_or_workgroup: dr.domain_or_workgroup, drive: dr.drive_letter, free_gb: dr.free_gb, pct: Math.round(pct * 10) / 10, level: 'critical' });
    } else if (pct < 10 || dr.free_gb < 10) {
      diskWarnServers.add(dr.hostname);
      diskAlerts.push({ hostname: dr.hostname, domain_or_workgroup: dr.domain_or_workgroup, drive: dr.drive_letter, free_gb: dr.free_gb, pct: Math.round(pct * 10) / 10, level: 'warning' });
    }
  }
  // Remove any server already counted as critical from warnings
  for (const h of diskCritServers) diskWarnServers.delete(h);

  // OS distribution
  const osDistribution = d.prepare('SELECT os_edition, COUNT(*) as count FROM servers' + w + ' GROUP BY os_edition ORDER BY count DESC').all(...domainParams);

  // Hypervisor distribution
  const hypervisorDistribution = d.prepare("SELECT COALESCE(hypervisor, 'Physical') as hypervisor, COUNT(*) as count FROM servers" + w + ' GROUP BY hypervisor ORDER BY count DESC').all(...domainParams);

  // Domain health breakdown
  const dhParams = (allowedDomains && allowedDomains.length > 0 && !domain)
    ? allowedDomains
    : [];
  const dhWhere = dhParams.length > 0
    ? ` WHERE domain_or_workgroup IN (${dhParams.map(() => '?').join(',')})`
    : '';
  const domainHealth = d.prepare(`SELECT domain_or_workgroup as domain,
    COUNT(*) as total,
    SUM(CASE WHEN missing_critical_updates > 0 THEN 1 ELSE 0 END) as missingUpdates,
    SUM(CASE WHEN critical_events_24h > 0 THEN 1 ELSE 0 END) as criticalEvents,
    SUM(CASE WHEN reboot_pending = 1 THEN 1 ELSE 0 END) as rebootPending,
    SUM(CASE WHEN maintenance_mode = 1 AND maintenance_until > datetime('now') THEN 1 ELSE 0 END) as inMaintenance
    FROM servers${dhWhere} GROUP BY domain_or_workgroup ORDER BY total DESC`).all(...dhParams);

  // Attention list (server-side, top 50)
  const attentionWhere = domain
    ? 'AND domain_or_workgroup = ?'
    : (allowedDomains && allowedDomains.length > 0)
      ? `AND domain_or_workgroup IN (${allowedDomains.map(() => '?').join(',')})`
      : '';
  const attentionParams = domain ? domainParams : (allowedDomains && allowedDomains.length > 0) ? allowedDomains : [];
  const attentionServers = d.prepare(`SELECT hostname, domain_or_workgroup, missing_critical_updates, critical_events_24h,
    reboot_pending, antivirus_status, rdp_enabled, nla_enabled,
    maintenance_mode, maintenance_until, last_heartbeat, stopped_services
    FROM servers
    WHERE (missing_critical_updates > 0 OR critical_events_24h > 0 OR reboot_pending = 1
    OR (antivirus_status IS NOT NULL AND LOWER(antivirus_status) NOT IN ('active','enabled','up to date'))
    OR (rdp_enabled = 1 AND (nla_enabled = 0 OR nla_enabled IS NULL))
    OR (maintenance_mode = 1 AND maintenance_until > datetime('now'))
    OR (last_heartbeat IS NOT NULL AND last_heartbeat < datetime('now', '-3 minutes'))
    OR stopped_services > 0)
    ${attentionWhere}
    ORDER BY
      CASE WHEN maintenance_mode = 1 AND maintenance_until > datetime('now') THEN 1 ELSE 0 END,
      CASE WHEN last_heartbeat IS NOT NULL AND last_heartbeat < datetime('now', '-3 minutes') THEN 0 ELSE 1 END,
      missing_critical_updates DESC, critical_events_24h DESC
    LIMIT 50`).all(...attentionParams);

  // Domains list for filter (always show all domains user has access to)
  let domainsQuery, domainsParams;
  if (allowedDomains && allowedDomains.length > 0) {
    domainsQuery = `SELECT DISTINCT domain_or_workgroup FROM servers WHERE domain_or_workgroup IN (${allowedDomains.map(() => '?').join(',')}) ORDER BY domain_or_workgroup`;
    domainsParams = allowedDomains;
  } else {
    domainsQuery = 'SELECT DISTINCT domain_or_workgroup FROM servers WHERE domain_or_workgroup IS NOT NULL ORDER BY domain_or_workgroup';
    domainsParams = [];
  }
  const domains = d.prepare(domainsQuery).all(...domainsParams).map(r => r.domain_or_workgroup);

  return {
    total, virtual, physical, rebootPending, missingUpdates,
    rdpEnabled, criticalEvents, staleServers, inMaintenance,
    online, offline, neverReported, serviceIssues,
    diskWarning: diskWarnServers.size, diskCritical: diskCritServers.size,
    diskAlerts,
    osDistribution, hypervisorDistribution,
    domainHealth, attentionServers, domains,
    domainCount: domains.length
  };
}

function searchServers(query) {
  const d = getDb();
  const like = `%${query}%`;
  return d.prepare(`SELECT * FROM servers WHERE
    hostname LIKE ? OR fqdn LIKE ? OR os_edition LIKE ? OR domain_or_workgroup LIKE ? OR cpu_model LIKE ?
    ORDER BY hostname LIMIT 50`).all(like, like, like, like, like);
}

// Purge old history data
function purgeHistory(days) {
  const d = getDb();
  const cutoff = days || 90;
  d.prepare(`DELETE FROM disk_history WHERE recorded_at < datetime('now', '-' || ? || ' days')`).run(cutoff);
  d.prepare(`DELETE FROM server_snapshots WHERE recorded_at < datetime('now', '-' || ? || ' days')`).run(cutoff);
}

// --- Domain GPOs ---
function upsertDomainGPOs(domain, gpos) {
  const d = getDb();
  const domainUpper = (domain || '').toUpperCase();
  if (!domainUpper || !Array.isArray(gpos)) return;

  // Remove old GPOs for this domain and re-insert
  const oldGpos = d.prepare('SELECT id FROM domain_gpos WHERE domain = ?').all(domainUpper);
  for (const g of oldGpos) {
    d.prepare('DELETE FROM domain_gpo_links WHERE gpo_id = ?').run(g.id);
    d.prepare('DELETE FROM domain_gpo_settings WHERE gpo_id = ?').run(g.id);
  }
  d.prepare('DELETE FROM domain_gpos WHERE domain = ?').run(domainUpper);

  const insGpo = d.prepare(`INSERT INTO domain_gpos (domain, gpo_name, gpo_guid, gpo_status, creation_time, modification_time, wmi_filter, description) VALUES (?,?,?,?,?,?,?,?)`);
  const insLink = d.prepare(`INSERT INTO domain_gpo_links (gpo_id, target, link_enabled, enforced, link_order) VALUES (?,?,?,?,?)`);
  const insSetting = d.prepare(`INSERT INTO domain_gpo_settings (gpo_id, area, category, setting_name, setting_value) VALUES (?,?,?,?,?)`);

  for (const gpo of gpos) {
    const result = insGpo.run(
      domainUpper, gpo.name || null, gpo.guid || null, gpo.status || null,
      gpo.creation_time || null, gpo.modification_time || null,
      gpo.wmi_filter || null, gpo.description || null
    );
    const gpoId = result.lastInsertRowid;

    if (Array.isArray(gpo.links)) {
      for (const link of gpo.links) {
        insLink.run(gpoId, link.target || null, link.enabled ? 1 : 0, link.enforced ? 1 : 0, link.order || null);
      }
    }

    if (Array.isArray(gpo.settings)) {
      for (const s of gpo.settings) {
        insSetting.run(gpoId, s.area || null, s.category || null, s.name || null, s.value || null);
      }
    }
  }
}

function getDomainGPOs(domain) {
  const d = getDb();
  let gpos;
  if (domain) {
    gpos = d.prepare('SELECT * FROM domain_gpos WHERE domain = ? ORDER BY gpo_name').all((domain || '').toUpperCase());
  } else {
    gpos = d.prepare('SELECT * FROM domain_gpos ORDER BY domain, gpo_name').all();
  }

  for (const gpo of gpos) {
    gpo.links = d.prepare('SELECT * FROM domain_gpo_links WHERE gpo_id = ? ORDER BY link_order').all(gpo.id);
    gpo.settings = d.prepare('SELECT * FROM domain_gpo_settings WHERE gpo_id = ? ORDER BY area, category, setting_name').all(gpo.id);
  }
  return gpos;
}

function getGPODomains() {
  const d = getDb();
  return d.prepare('SELECT DISTINCT domain FROM domain_gpos ORDER BY domain').all().map(r => r.domain);
}

// --- Domain DNS ---
function upsertDomainDNS(domain, zones) {
  const d = getDb();
  const domainUpper = (domain || '').toUpperCase();
  if (!domainUpper || !Array.isArray(zones)) return;

  const oldZones = d.prepare('SELECT id FROM domain_dns_zones WHERE domain = ?').all(domainUpper);
  for (const z of oldZones) {
    d.prepare('DELETE FROM domain_dns_records WHERE zone_id = ?').run(z.id);
  }
  d.prepare('DELETE FROM domain_dns_zones WHERE domain = ?').run(domainUpper);

  const insZone = d.prepare(`INSERT INTO domain_dns_zones (domain, zone_name, zone_type, is_reverse_lookup, is_ad_integrated, dynamic_update, aging_enabled, record_count) VALUES (?,?,?,?,?,?,?,?)`);
  const insRecord = d.prepare(`INSERT INTO domain_dns_records (zone_id, record_name, record_type, record_data, ttl) VALUES (?,?,?,?,?)`);

  for (const zone of zones) {
    const result = insZone.run(
      domainUpper, zone.name || null, zone.type || null,
      zone.is_reverse_lookup ? 1 : 0, zone.is_ad_integrated ? 1 : 0,
      zone.dynamic_update || null, zone.aging_enabled ? 1 : 0,
      zone.record_count || 0
    );
    const zoneId = result.lastInsertRowid;

    if (Array.isArray(zone.records)) {
      for (const r of zone.records) {
        insRecord.run(zoneId, r.name || null, r.type || null, r.data || null, r.ttl || null);
      }
    }
  }
}

function getDomainDNS(domain) {
  const d = getDb();
  let zones;
  if (domain) {
    zones = d.prepare('SELECT * FROM domain_dns_zones WHERE domain = ? ORDER BY zone_name').all((domain || '').toUpperCase());
  } else {
    zones = d.prepare('SELECT * FROM domain_dns_zones ORDER BY domain, zone_name').all();
  }

  for (const zone of zones) {
    zone.records = d.prepare('SELECT * FROM domain_dns_records WHERE zone_id = ? ORDER BY record_type, record_name').all(zone.id);
  }
  return zones;
}

function getDNSDomains() {
  const d = getDb();
  return d.prepare('SELECT DISTINCT domain FROM domain_dns_zones ORDER BY domain').all().map(r => r.domain);
}

// --- Server Logbook ---
function getLogbookEntries(serverId) {
  return getDb().prepare('SELECT * FROM server_logbook WHERE server_id = ? ORDER BY created_at DESC').all(serverId);
}

function getAllLogbookEntries(limit) {
  return getDb().prepare(`SELECT lb.*, s.hostname, s.domain_or_workgroup FROM server_logbook lb
    JOIN servers s ON lb.server_id = s.id
    ORDER BY lb.created_at DESC LIMIT ?`).all(limit || 500);
}

function addLogbookEntry(serverId, author, comment) {
  return getDb().prepare('INSERT INTO server_logbook (server_id, author, comment) VALUES (?,?,?)').run(serverId, author, comment);
}

function deleteLogbookEntry(id) {
  return getDb().prepare('DELETE FROM server_logbook WHERE id = ?').run(id).changes > 0;
}

// --- Maintenance Mode ---
function setMaintenanceMode(serverId, until, comment, author) {
  const d = getDb();
  d.prepare(`UPDATE servers SET maintenance_mode = 1, maintenance_until = ?, maintenance_comment = ?, maintenance_set_by = ? WHERE id = ?`)
    .run(until, comment || '', author || 'system', serverId);
}

function clearMaintenanceMode(serverId, author) {
  const d = getDb();
  d.prepare(`UPDATE servers SET maintenance_mode = 0, maintenance_until = NULL, maintenance_comment = NULL, maintenance_set_by = NULL WHERE id = ?`)
    .run(serverId);
}

function getMaintenanceStatus(serverId) {
  const d = getDb();
  const s = d.prepare('SELECT maintenance_mode, maintenance_until, maintenance_comment, maintenance_set_by FROM servers WHERE id = ?').get(serverId);
  if (!s || !s.maintenance_mode) return null;
  return { active: true, until: s.maintenance_until, comment: s.maintenance_comment, set_by: s.maintenance_set_by };
}

// --- Permission Groups ---
function getGroups() {
  const d = getDb();
  const groups = d.prepare('SELECT * FROM groups ORDER BY name').all();
  for (const g of groups) {
    g.domains = d.prepare('SELECT domain FROM group_domains WHERE group_id = ?').all(g.id).map(r => r.domain);
    g.members = d.prepare(`SELECT gm.user_id, u.username FROM group_members gm
      JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`).all(g.id);
  }
  return groups;
}

function getGroup(id) {
  const d = getDb();
  const g = d.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!g) return null;
  g.domains = d.prepare('SELECT domain FROM group_domains WHERE group_id = ?').all(g.id).map(r => r.domain);
  g.members = d.prepare(`SELECT gm.user_id, u.username FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`).all(g.id);
  return g;
}

function createGroup(name, description) {
  const d = getDb();
  return d.prepare('INSERT INTO groups (name, description) VALUES (?, ?)').run(name, description || '');
}

function updateGroup(id, name, description) {
  const d = getDb();
  return d.prepare('UPDATE groups SET name = ?, description = ? WHERE id = ?').run(name, description || '', id);
}

function deleteGroup(id) {
  const d = getDb();
  d.prepare('DELETE FROM group_domains WHERE group_id = ?').run(id);
  d.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
  return d.prepare('DELETE FROM groups WHERE id = ?').run(id).changes > 0;
}

function getGroupDomains(groupId) {
  return getDb().prepare('SELECT domain FROM group_domains WHERE group_id = ?').all(groupId).map(r => r.domain);
}

function setGroupDomains(groupId, domains) {
  const d = getDb();
  d.prepare('DELETE FROM group_domains WHERE group_id = ?').run(groupId);
  const ins = d.prepare('INSERT INTO group_domains (group_id, domain) VALUES (?, ?)');
  for (const dom of domains) {
    ins.run(groupId, dom);
  }
}

function getGroupMembers(groupId) {
  return getDb().prepare(`SELECT gm.user_id, u.username FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`).all(groupId);
}

function addGroupMember(groupId, userId) {
  const d = getDb();
  try {
    d.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
    return true;
  } catch (e) {
    return false; // already exists (UNIQUE constraint)
  }
}

function removeGroupMember(groupId, userId) {
  return getDb().prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId).changes > 0;
}

function getUserAllowedDomains(userId) {
  const d = getDb();
  const user = d.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (!user) return [];
  if (user.role === 'admin') return null; // null = all domains
  const rows = d.prepare(`SELECT DISTINCT gd.domain FROM group_members gm
    JOIN group_domains gd ON gm.group_id = gd.group_id
    WHERE gm.user_id = ?`).all(userId);
  return rows.map(r => r.domain);
}

// --- Heartbeat ---
function processHeartbeat(data) {
  const d = getDb();
  const hostname = (data.hostname || '').toUpperCase();
  if (!hostname) return null;

  const server = d.prepare('SELECT id FROM servers WHERE hostname = ?').get(hostname);
  if (!server) return null; // server must already exist from full inventory

  const serverId = server.id;

  // Update live metrics + heartbeat timestamp
  d.prepare(`UPDATE servers SET
    cpu_usage = ?, ram_used_gb = ?, stopped_services = ?,
    last_heartbeat = datetime('now'), updated_at = datetime('now')
    WHERE id = ?`).run(
    data.cpu_usage ?? null, data.ram_used_gb ?? null,
    data.stopped_services ?? 0, serverId
  );

  // Replace disks if provided
  if (Array.isArray(data.disks) && data.disks.length > 0) {
    d.prepare('DELETE FROM server_disks WHERE server_id = ?').run(serverId);
    const insDisk = d.prepare('INSERT INTO server_disks (server_id, drive_letter, volume_label, size_gb, free_gb, file_system) VALUES (?,?,?,?,?,?)');
    const insDiskHist = d.prepare('INSERT INTO disk_history (server_id, drive_letter, size_gb, free_gb) VALUES (?,?,?,?)');
    for (const disk of data.disks) {
      insDisk.run(serverId, disk.drive_letter || null, disk.volume_label || null, disk.size_gb || null, disk.free_gb || null, disk.file_system || null);
      insDiskHist.run(serverId, disk.drive_letter || null, disk.size_gb || null, disk.free_gb || null);
    }
  }

  // Replace services if provided
  if (Array.isArray(data.services)) {
    d.prepare('DELETE FROM server_services WHERE server_id = ?').run(serverId);
    const insSvc = d.prepare('INSERT INTO server_services (server_id, name, display_name, status, start_type) VALUES (?,?,?,?,?)');
    for (const s of data.services) {
      insSvc.run(serverId, s.name || null, s.display_name || null, s.status || null, s.start_type || null);
    }
  }

  // CPU/RAM snapshot
  d.prepare('INSERT INTO server_snapshots (server_id, cpu_usage, ram_used_gb) VALUES (?,?,?)').run(
    serverId, data.cpu_usage ?? null, data.ram_used_gb ?? null
  );

  return serverId;
}

module.exports = {
  getDb, initSchema,
  createUser, getUserByUsername, updateLastLogin, getUsers, deleteUser, updateUserPassword,
  createApiKey, validateApiKey, getApiKeys, revokeApiKey, deleteApiKey,
  upsertServer, getServers, getServer, getServerById, getServerDetails,
  getDiskHistory, getServerSnapshots, deleteServer, getServerCount,
  getDashboardStats, searchServers, purgeHistory,
  upsertDomainGPOs, getDomainGPOs, getGPODomains,
  upsertDomainDNS, getDomainDNS, getDNSDomains,
  getLogbookEntries, getAllLogbookEntries, addLogbookEntry, deleteLogbookEntry,
  setMaintenanceMode, clearMaintenanceMode, getMaintenanceStatus,
  getGroups, getGroup, createGroup, updateGroup, deleteGroup,
  getGroupDomains, setGroupDomains,
  getGroupMembers, addGroupMember, removeGroupMember,
  getUserAllowedDomains,
  processHeartbeat,
};
