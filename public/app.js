/* =========================================================================
   Inventory Web — Frontend Application
   ========================================================================= */

(function () {
  'use strict';

  // --- State ---
  let allServers = [];
  let currentUser = null;
  let charts = {};
  let serverPage = 1;
  let serverSort = 'hostname';
  let serverDir = 'ASC';
  let serverDomain = '';
  let serverSearch = '';
  let dashboardStats = null;

  // --- Init ---
  document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupTabs();
    setupTheme();
    setupHelpModals();
    setupLogout();
    setupModalClose();

    // Lock body scroll when any modal is open
    new MutationObserver(() => {
      const anyOpen = document.querySelector('.modal-overlay.open');
      document.body.classList.toggle('modal-open', !!anyOpen);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    setupColumnSort();
    await loadDashboard();
    await loadServers();
  });

  // =========================================================================
  //  AUTH
  // =========================================================================
  async function checkAuth() {
    try {
      const r = await fetch('/api/auth/me');
      const d = await r.json();
      if (!d.authenticated) {
        window.location.href = '/login.html';
        return;
      }
      currentUser = d.user;
      document.getElementById('userBadge').textContent = currentUser.username + ' (' + currentUser.role + ')';
    } catch (e) {
      window.location.href = '/login.html';
    }
  }

  function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // =========================================================================
  //  THEME
  // =========================================================================
  function setupTheme() {
    const saved = localStorage.getItem('inv-theme') || 'dark';
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeToggle').addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
      localStorage.setItem('inv-theme', isLight ? 'dark' : 'light');
      rebuildCharts();
    });
  }

  // =========================================================================
  //  HELP MODALS
  // =========================================================================
  function setupHelpModals() {
    ['info', 'ps'].forEach(key => {
      const modal = document.getElementById(key + 'Modal');
      document.getElementById(key + 'Btn').addEventListener('click', () => modal.classList.add('open'));
      document.getElementById(key + 'ModalClose').addEventListener('click', () => modal.classList.remove('open'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
    });
    document.querySelectorAll('.code-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.parentElement.querySelector('pre').textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  // =========================================================================
  //  TABS
  // =========================================================================
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('tab-' + btn.dataset.tab);
        if (panel) panel.classList.add('active');

        // Lazy load tab data
        if (btn.dataset.tab === 'domains') loadDomainsView();
        if (btn.dataset.tab === 'logbook') loadGlobalLogbook();
        if (btn.dataset.tab === 'maintenance') loadMaintenanceView();
        if (btn.dataset.tab === 'security') loadSecurityView();
        if (btn.dataset.tab === 'cves') loadCvesView();
      });
    });

    // Clickable logo/title → Dashboard
    const topbarHome = document.getElementById('topbarHome');
    if (topbarHome) {
      topbarHome.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const dashBtn = document.querySelector('.tab-btn[data-tab="dashboard"]');
        if (dashBtn) dashBtn.classList.add('active');
        const dashPanel = document.getElementById('tab-dashboard');
        if (dashPanel) dashPanel.classList.add('active');
        loadDashboard();
      });
    }

    // User badge click → Admin modal (admin only)
    const userBadge = document.getElementById('userBadge');
    if (userBadge) {
      userBadge.addEventListener('click', () => {
        if (currentUser?.role !== 'admin') return;
        const modal = document.getElementById('adminModal');
        modal.classList.add('open');
        loadAdmin();
      });
    }

    // Admin modal close
    const adminClose = document.getElementById('adminModalClose');
    if (adminClose) {
      adminClose.addEventListener('click', () => {
        document.getElementById('adminModal').classList.remove('open');
      });
    }
    const adminModal = document.getElementById('adminModal');
    if (adminModal) {
      adminModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
      });
    }
  }

  // =========================================================================
  //  DASHBOARD
  // =========================================================================
  let dashboardDomainBound = false;

  async function loadDashboard() {
    try {
      const domFilter = document.getElementById('dashboardDomainFilter');
      const domain = domFilter ? domFilter.value : '';
      const url = domain ? '/api/dashboard/stats?domain=' + encodeURIComponent(domain) : '/api/dashboard/stats';
      const r = await fetch(url);
      const stats = await r.json();
      dashboardStats = stats;
      renderStats(stats);
      renderCharts(stats);
      renderAttention(stats);
      populateDomainFilters(stats.domains || []);
      if (domFilter) domFilter.value = domain;
      if (!dashboardDomainBound && domFilter) {
        dashboardDomainBound = true;
        domFilter.addEventListener('change', () => {
          Object.values(charts).forEach(c => c && c.destroy());
          charts = {};
          loadDashboard();
        });
      }
    } catch (e) {
      console.error('Dashboard error:', e);
    }
  }

  function populateDomainFilters(domains) {
    const selectors = ['serverDomainFilter', 'dashboardDomainFilter', 'logbookDomainFilter', 'attentionDomainFilter'];
    for (const id of selectors) {
      const sel = document.getElementById(id);
      if (!sel) continue;
      const current = sel.value;
      sel.innerHTML = '<option value="">All Domains</option>' +
        domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
      sel.value = current;
    }
  }

  function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    const hasHeartbeat = stats.online > 0 || stats.offline > 0;
    const kpiStyle = 'cursor:pointer;';
    grid.innerHTML = `
      <div class="stat-card accent" style="${kpiStyle}" onclick="showKpiOverlay('domains')">
        <div class="stat-label">Total Domains</div>
        <div class="stat-value">${stats.domainCount || 0}</div>
        <div class="stat-sub">active domains</div>
      </div>
      <div class="stat-card accent" style="${kpiStyle}" onclick="showKpiOverlay('total')">
        <div class="stat-label">Total Servers</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-sub">${stats.virtual} virtual, ${stats.physical} physical</div>
      </div>
      ${hasHeartbeat ? `<div class="stat-card ${stats.offline > 0 ? 'danger' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('status')">
        <div class="stat-label">Server Status</div>
        <div class="stat-value">${stats.online} <span style="font-size:14px;color:var(--text3)">/ ${stats.total - stats.neverReported}</span></div>
        <div class="stat-sub">${stats.online} online, ${stats.offline} offline${stats.neverReported > 0 ? ', ' + stats.neverReported + ' no heartbeat' : ''}</div>
      </div>` : ''}
      <div class="stat-card ${stats.rebootPending > 0 ? 'warning' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('reboot')">
        <div class="stat-label">Reboot Pending</div>
        <div class="stat-value">${stats.rebootPending}</div>
        <div class="stat-sub">servers need restart</div>
      </div>
      <div class="stat-card ${stats.missingUpdates > 0 ? 'danger' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('updates')">
        <div class="stat-label">Missing Updates</div>
        <div class="stat-value">${stats.missingUpdates}</div>
        <div class="stat-sub">servers with critical patches missing</div>
      </div>
      <div class="stat-card ${stats.criticalEvents > 0 ? 'danger' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('events')">
        <div class="stat-label">Critical Events</div>
        <div class="stat-value">${stats.criticalEvents}</div>
        <div class="stat-sub">servers with critical errors (24h)</div>
      </div>
      <div class="stat-card ${stats.diskCritical > 0 ? 'danger' : stats.diskWarning > 0 ? 'warning' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('disk')">
        <div class="stat-label">Disk Space</div>
        <div class="stat-value">${stats.diskCritical > 0 ? stats.diskCritical : stats.diskWarning}</div>
        <div class="stat-sub">${stats.diskCritical > 0 ? stats.diskCritical + ' critical' : ''} ${stats.diskWarning > 0 ? stats.diskWarning + ' warning' : ''} ${stats.diskCritical === 0 && stats.diskWarning === 0 ? 'all disks healthy' : ''}</div>
      </div>
      ${stats.serviceIssues > 0 ? `<div class="stat-card warning" style="${kpiStyle}" onclick="showKpiOverlay('services')">
        <div class="stat-label">Service Issues</div>
        <div class="stat-value">${stats.serviceIssues}</div>
        <div class="stat-sub">servers with stopped auto-start services</div>
      </div>` : ''}
      <div class="stat-card ${stats.inMaintenance > 0 ? 'warning' : 'success'}" style="${kpiStyle}" onclick="showKpiOverlay('maintenance')">
        <div class="stat-label">In Maintenance</div>
        <div class="stat-value">${stats.inMaintenance}</div>
        <div class="stat-sub">${stats.inMaintenance > 0 ? 'servers in maintenance' : 'no servers in maintenance'}</div>
      </div>
    `;
  }

  function getChartColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      text: cs.getPropertyValue('--text2').trim() || '#9ca3b0',
      grid: cs.getPropertyValue('--border').trim() || '#2a2d37',
      accent: '#4f8cff',
      success: '#3ddfa0',
      warning: '#f5a623',
      danger: '#ff4d6a',
      info: '#6ec1e4',
      palette: ['#4f8cff', '#3ddfa0', '#f5a623', '#ff4d6a', '#6ec1e4', '#a78bfa', '#f472b6', '#fbbf24']
    };
  }

  function renderCharts(stats) {
    const colors = getChartColors();
    const grid = document.getElementById('chartsGrid');
    grid.innerHTML = `
      <div class="chart-card">
        <h3>OS Distribution</h3>
        <div class="chart-canvas-wrap"><canvas id="chartOS"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Physical vs Virtual</h3>
        <div class="chart-canvas-wrap"><canvas id="chartType"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Health Overview</h3>
        <div class="chart-canvas-wrap"><canvas id="chartHealth"></canvas></div>
      </div>
      ${(stats.domainHealth || []).length > 1 ? `<div class="chart-card" style="grid-column: 1 / -1;">
        <h3>Domain Health Breakdown</h3>
        <div class="chart-canvas-wrap" style="height:${Math.max(250, (stats.domainHealth || []).length * 36)}px;"><canvas id="chartDomainHealth"></canvas></div>
      </div>` : ''}
    `;

    // OS Distribution
    const osLabels = (stats.osDistribution || []).map(o => o.os_edition || 'Unknown');
    const osData = (stats.osDistribution || []).map(o => o.count);
    charts.os = new Chart(document.getElementById('chartOS'), {
      type: 'doughnut',
      data: {
        labels: osLabels,
        datasets: [{ data: osData, backgroundColor: colors.palette.slice(0, osLabels.length), borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: colors.text, font: { size: 11 } } } } }
    });

    // Physical vs Virtual
    charts.type = new Chart(document.getElementById('chartType'), {
      type: 'doughnut',
      data: {
        labels: ['Virtual', 'Physical'],
        datasets: [{ data: [stats.virtual, stats.physical], backgroundColor: [colors.accent, colors.info], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: colors.text, font: { size: 11 } } } } }
    });

    // Health overview
    const healthy = stats.total - stats.missingUpdates - stats.criticalEvents;
    charts.health = new Chart(document.getElementById('chartHealth'), {
      type: 'bar',
      data: {
        labels: ['Healthy', 'Missing Updates', 'Critical Events', 'Reboot Pending', 'RDP Enabled'],
        datasets: [{
          data: [Math.max(0, healthy), stats.missingUpdates, stats.criticalEvents, stats.rebootPending, stats.rdpEnabled],
          backgroundColor: [colors.success, colors.danger, colors.danger, colors.warning, colors.warning],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });

    // Domain Health Breakdown (stacked horizontal bar)
    const dh = stats.domainHealth || [];
    if (dh.length > 1) {
      const dhLabels = dh.map(d => d.domain || 'Unknown');
      const dhHealthy = dh.map(d => d.total - d.missingUpdates - d.criticalEvents - d.rebootPending);
      charts.domainHealth = new Chart(document.getElementById('chartDomainHealth'), {
        type: 'bar',
        data: {
          labels: dhLabels,
          datasets: [
            { label: 'Healthy', data: dhHealthy, backgroundColor: colors.success, borderRadius: 4 },
            { label: 'Missing Updates', data: dh.map(d => d.missingUpdates), backgroundColor: colors.danger, borderRadius: 4 },
            { label: 'Critical Events', data: dh.map(d => d.criticalEvents), backgroundColor: '#ff4d6a88', borderRadius: 4 },
            { label: 'Reboot Pending', data: dh.map(d => d.rebootPending), backgroundColor: colors.warning, borderRadius: 4 },
            { label: 'In Maintenance', data: dh.map(d => d.inMaintenance), backgroundColor: '#f59e0b88', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { labels: { color: colors.text, font: { size: 11 } } } },
          scales: {
            x: { stacked: true, ticks: { color: colors.text }, grid: { color: colors.grid } },
            y: { stacked: true, ticks: { color: colors.text, font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    }
  }

  let lastAttentionStats = null;

  function renderAttention(stats) {
    lastAttentionStats = stats;
    const body = document.getElementById('attentionBody');
    const rows = [];
    const attFilter = (document.getElementById('attentionDomainFilter') || {}).value || '';
    const attServers = (stats.attentionServers || []).filter(s => !attFilter || s.domain_or_workgroup === attFilter);
    for (const s of attServers) {
      if (s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date()) {
        rows.push({ hostname: s.hostname, issue: '\ud83d\udd27 In maintenance until ' + fmtDate(s.maintenance_until), badge: 'badge-maintenance' });
        continue;
      }
      if (s.missing_critical_updates > 0) rows.push({ hostname: s.hostname, issue: `${s.missing_critical_updates} missing critical updates`, badge: 'badge-red' });
      if (s.critical_events_24h > 0) rows.push({ hostname: s.hostname, issue: `${s.critical_events_24h} critical events (24h)`, badge: 'badge-red' });
      if (s.reboot_pending) rows.push({ hostname: s.hostname, issue: 'Reboot pending', badge: 'badge-yellow' });
      if (s.antivirus_status && s.antivirus_status.toLowerCase() !== 'active' && s.antivirus_status.toLowerCase() !== 'enabled' && s.antivirus_status.toLowerCase() !== 'up to date') {
        rows.push({ hostname: s.hostname, issue: 'AV: ' + s.antivirus_status, badge: 'badge-red' });
      }
      if (s.rdp_enabled && !s.nla_enabled) rows.push({ hostname: s.hostname, issue: 'RDP enabled without NLA', badge: 'badge-yellow' });
      if (s.last_heartbeat && (new Date() - new Date(s.last_heartbeat + 'Z')) > 3 * 60000) {
        rows.push({ hostname: s.hostname, issue: 'Offline — last heartbeat ' + timeAgo(s.last_heartbeat), badge: 'badge-red' });
      }
      if (s.stopped_services > 0) rows.push({ hostname: s.hostname, issue: s.stopped_services + ' stopped auto-start service' + (s.stopped_services > 1 ? 's' : ''), badge: 'badge-yellow' });
    }
    // Disk space alerts from dashboard stats
    const maintHostnames = new Set(attServers.filter(s => s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date()).map(s => s.hostname));
    if (stats.diskAlerts) {
      for (const da of stats.diskAlerts) {
        if (maintHostnames.has(da.hostname)) continue;
        if (attFilter && da.domain_or_workgroup && da.domain_or_workgroup !== attFilter) continue;
        rows.push({ hostname: da.hostname, issue: `${da.drive} ${da.free_gb} GB free (${da.pct}%)`, badge: da.level === 'critical' ? 'badge-red' : 'badge-yellow' });
      }
    }
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px;">All servers healthy</td></tr>';
      return;
    }
    body.innerHTML = rows.map(r => `
      <tr data-hostname="${esc(r.hostname)}">
        <td><strong>${esc(r.hostname)}</strong></td>
        <td>${esc(r.issue)}</td>
        <td><span class="badge ${r.badge}">${r.badge === 'badge-red' ? 'Critical' : r.badge === 'badge-maintenance' ? 'Maintenance' : 'Warning'}</span></td>
      </tr>
    `).join('');
    body.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => openServerDetail(tr.dataset.hostname));
    });
  }

  function rebuildCharts() {
    Object.values(charts).forEach(c => c && c.destroy());
    charts = {};
    loadDashboard();
  }

  // Attention domain filter
  const attDomFilter = document.getElementById('attentionDomainFilter');
  if (attDomFilter) {
    attDomFilter.addEventListener('change', () => {
      if (lastAttentionStats) renderAttention(lastAttentionStats);
    });
  }

  // =========================================================================
  //  SERVERS
  // =========================================================================
  async function loadServers() {
    try {
      const params = new URLSearchParams({
        page: serverPage, limit: 100,
        sort: serverSort, dir: serverDir
      });
      if (serverSearch) params.set('q', serverSearch);
      if (serverDomain) params.set('domain', serverDomain);
      const r = await fetch('/api/servers?' + params);
      const result = await r.json();
      allServers = result.data || [];
      renderServerTable(allServers);
      renderPagination(result);
      setupServerSearch();
    } catch (e) {
      console.error('Servers error:', e);
    }
  }

  function renderPagination(result) {
    let pag = document.getElementById('serverPagination');
    if (!pag) {
      pag = document.createElement('div');
      pag.id = 'serverPagination';
      pag.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;';
      document.getElementById('serverTable').parentElement.parentElement.appendChild(pag);
    }
    const { page, totalPages, total } = result;
    if (totalPages <= 1) { pag.innerHTML = `<span style="color:var(--text3);font-size:12px;">${total} servers</span>`; return; }
    let html = `<span style="color:var(--text3);font-size:12px;">${total} servers &mdash; Page ${page} of ${totalPages}</span>&nbsp;`;
    html += `<button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} data-page="1" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&laquo;</button>`;
    html += `<button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&lsaquo;</button>`;
    html += `<button class="btn btn-sm" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&rsaquo;</button>`;
    html += `<button class="btn btn-sm" ${page >= totalPages ? 'disabled' : ''} data-page="${totalPages}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&raquo;</button>`;
    pag.innerHTML = html;
    pag.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        serverPage = parseInt(btn.dataset.page, 10);
        loadServers();
      });
    });
  }

  function renderServerTable(servers) {
    const body = document.getElementById('serverBody');
    if (servers.length === 0) {
      body.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:40px;">No servers found. Deploy the PowerShell collection script to start populating data.</td></tr>';
      return;
    }
    const now = new Date();
    body.innerHTML = servers.map(s => {
      const ramPct = s.ram_total_gb ? Math.round((s.ram_used_gb / s.ram_total_gb) * 100) : 0;
      const cpuClass = s.cpu_usage > 90 ? 'badge-red' : s.cpu_usage > 70 ? 'badge-yellow' : 'badge-green';
      const patchBadge = s.missing_critical_updates > 0 ? 'badge-red' : 'badge-green';
      const avOk = s.antivirus_status && (s.antivirus_status.toLowerCase() === 'active' || s.antivirus_status.toLowerCase() === 'enabled' || s.antivirus_status.toLowerCase() === 'up to date');
      const avBadge = avOk ? 'badge-green' : s.antivirus_status ? 'badge-red' : 'badge-gray';
      const rebootBadge = s.reboot_pending ? 'badge-yellow' : 'badge-green';
      const typeLabel = s.is_virtual ? 'VM' : 'Physical';
      const updated = s.updated_at ? fmtDate(s.updated_at) : 'Never';
      const isStale = s.updated_at && (now - new Date(s.updated_at)) > 7 * 86400000;
      // Heartbeat status
      let hbStatus, hbBadge;
      if (!s.last_heartbeat) {
        hbStatus = '-'; hbBadge = 'badge-gray';
      } else if ((now - new Date(s.last_heartbeat + 'Z')) < 3 * 60000) {
        hbStatus = 'Online'; hbBadge = 'badge-green';
      } else {
        hbStatus = 'Offline'; hbBadge = 'badge-red';
      }
      return `<tr data-hostname="${esc(s.hostname)}">
        <td><strong>${esc(s.hostname)}</strong>${s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date() ? ' <span class="maintenance-icon" title="In maintenance">\ud83d\udd27</span>' : ''}</td>
        <td><span class="badge ${hbBadge}">${hbStatus}</span></td>
        <td>${esc(s.os_edition || '-')}</td>
        <td><span class="badge badge-blue">${typeLabel}</span></td>
        <td><span class="badge ${cpuClass}">${s.cpu_usage != null ? s.cpu_usage + '%' : '-'}</span></td>
        <td>${s.ram_used_gb != null ? s.ram_used_gb.toFixed(1) : '-'} / ${s.ram_total_gb != null ? s.ram_total_gb.toFixed(1) : '-'} GB (${ramPct}%)</td>
        <td><span class="badge ${patchBadge}">${s.missing_critical_updates > 0 ? s.missing_critical_updates + ' missing' : 'OK'}</span></td>
        <td><span class="badge ${avBadge}">${esc(s.antivirus_status || '-')}</span></td>
        <td><span class="badge ${rebootBadge}">${s.reboot_pending ? 'Yes' : 'No'}</span></td>
        <td>${esc(updated)}</td>
        <td>${isStale ? `<button class="btn-delete-server" data-hostname="${esc(s.hostname)}" title="Delete server">✕</button>` : ''}</td>
      </tr>`;
    }).join('');

    body.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-server')) return;
        openServerDetail(tr.dataset.hostname);
      });
    });
    body.querySelectorAll('.btn-delete-server').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const hostname = btn.dataset.hostname;
        if (!confirm(`Delete server ${hostname}? This cannot be undone.`)) return;
        try {
          const r = await fetch('/api/servers/' + encodeURIComponent(hostname), { method: 'DELETE' });
          if (r.ok) {
            loadServers();
          } else {
            const err = await r.json();
            alert(err.error || 'Failed to delete server');
          }
        } catch (ex) { alert('Error deleting server'); }
      });
    });
  }

  function setupServerSearch() {
    const input = document.getElementById('serverSearch');
    if (input._bound) return;
    input._bound = true;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        serverSearch = input.value.trim();
        serverPage = 1;
        loadServers();
      }, 300);
    });

    // Domain filter
    const domainFilter = document.getElementById('serverDomainFilter');
    if (domainFilter && !domainFilter._bound) {
      domainFilter._bound = true;
      domainFilter.addEventListener('change', () => {
        serverDomain = domainFilter.value;
        serverPage = 1;
        loadServers();
      });
    }
  }

  function setupColumnSort() {
    document.querySelectorAll('#serverTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (serverSort === col) {
          serverDir = serverDir === 'ASC' ? 'DESC' : 'ASC';
        } else {
          serverSort = col;
          serverDir = 'ASC';
        }
        // Update header indicators
        document.querySelectorAll('#serverTable th.sortable').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(serverDir === 'ASC' ? 'sort-asc' : 'sort-desc');
        serverPage = 1;
        loadServers();
      });
    });
  }

  // =========================================================================
  //  SERVER DETAIL MODAL
  // =========================================================================
  async function openServerDetail(hostname) {
    const modal = document.getElementById('serverModal');
    const body = document.getElementById('modalBody');
    document.getElementById('modalHostname').textContent = hostname;
    body.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    modal.classList.add('open');

    try {
      const r = await fetch('/api/servers/' + encodeURIComponent(hostname));
      if (!r.ok) { body.innerHTML = '<p>Server not found</p>'; return; }
      const s = await r.json();
      renderServerDetail(s, body);
    } catch (e) {
      body.innerHTML = '<p>Error loading server details</p>';
    }
  }

  function renderServerDetail(s, container) {
    const ramPct = s.ram_total_gb ? Math.round((s.ram_used_gb / s.ram_total_gb) * 100) : 0;
    const avOk = s.antivirus_status && ['active', 'enabled', 'up to date'].includes(s.antivirus_status.toLowerCase());
    const rdpBadge = s.rdp_enabled ? (s.nla_enabled ? 'badge-green' : 'badge-yellow') : 'badge-green';
    const rdpLabel = s.rdp_enabled ? (s.nla_enabled ? 'Enabled (NLA)' : 'Enabled (no NLA)') : 'Disabled';

    // Maintenance mode check
    const maintActive = s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date();
    const maintUntil = maintActive ? new Date(s.maintenance_until) : null;

    let html = '';

    // Maintenance banner + Add logbook entry button at top of popup
    if (maintActive) {
      const remaining = Math.max(0, Math.ceil((maintUntil - new Date()) / 60000));
      const hrs = Math.floor(remaining / 60);
      const mins = remaining % 60;
      html += `<div class="maintenance-banner">
        <span class="maint-icon">\ud83d\udd27</span>
        <div class="maint-info">
          <div class="maint-title">Maintenance Mode Active</div>
          <div class="maint-detail">Until: ${fmtDate(s.maintenance_until)} (${hrs}h ${mins}m remaining)</div>
          <div class="maint-detail">Comment: ${esc(s.maintenance_comment || '-')} &mdash; Set by: ${esc(s.maintenance_set_by || '-')}</div>
        </div>
        <button class="btn btn-sm" id="maintEndBtn" style="background:var(--danger);color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;">End Maintenance</button>
      </div>`;
    } else {
      html += `<div style="padding:4px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm" id="maintStartBtn" style="background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600;">\ud83d\udd27 Set Maintenance</button>
        <button class="btn btn-sm" id="logbookQuickBtn" style="background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600;">\ud83d\udcdd Add Logbook Entry</button>
        <div id="maintFormWrap" style="display:none;" class="maint-form">
          <select id="maintHours">
            <option value="0.5">30 min</option>
            <option value="1">1 hour</option>
            <option value="2" selected>2 hours</option>
            <option value="4">4 hours</option>
            <option value="8">8 hours</option>
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
          </select>
          <input type="text" id="maintComment" placeholder="Comment..." style="flex:1;min-width:180px;">
          <button class="btn btn-primary" id="maintConfirmBtn" style="padding:6px 14px;font-size:12px;">Confirm</button>
          <button class="btn" id="maintCancelBtn" style="padding:6px 14px;font-size:12px;">Cancel</button>
        </div>
        <div id="logbookQuickForm" style="display:none;flex:1;min-width:250px;">
          <div style="display:flex;gap:8px;">
            <input type="text" class="search-input" id="logbookQuickInput" placeholder="Logbook entry..." style="flex:1;">
            <button class="btn btn-primary" id="logbookQuickSubmit" style="padding:6px 14px;font-size:12px;">Add</button>
            <button class="btn" id="logbookQuickCancel" style="padding:6px 14px;font-size:12px;">Cancel</button>
          </div>
        </div>
      </div>`;
    }

    html += `
    <div class="detail-section-header" id="detailGridToggle" onclick="this.classList.toggle('collapsed');document.getElementById('detailGridBody').classList.toggle('collapsed');">
      <span class="toggle-icon">▼</span> Server Details
    </div>
    <div class="detail-grid" id="detailGridBody">
      <div class="detail-item"><div class="dl">Hostname</div><div class="dv">${esc(s.hostname)}</div></div>
      <div class="detail-item"><div class="dl">FQDN</div><div class="dv">${esc(s.fqdn || '-')}</div></div>
      <div class="detail-item"><div class="dl">Domain / Workgroup</div><div class="dv">${esc(s.domain_or_workgroup || '-')} (${esc(s.domain_type || '-')})</div></div>
      <div class="detail-item"><div class="dl">OU</div><div class="dv">${esc(s.ou || '-')}</div></div>
      <div class="detail-item"><div class="dl">OS</div><div class="dv">${esc(s.os_edition || '-')}</div></div>
      <div class="detail-item"><div class="dl">Version / Build</div><div class="dv">${esc(s.os_version || '-')} / ${esc(s.os_build || '-')}</div></div>
      <div class="detail-item"><div class="dl">Install Date</div><div class="dv">${fmtDate(s.install_date)}</div></div>
      <div class="detail-item"><div class="dl">Last Boot</div><div class="dv">${fmtDate(s.last_boot)}</div></div>
      <div class="detail-item"><div class="dl">Activation</div><div class="dv">${esc(s.activation_status || '-')}</div></div>
      <div class="detail-item"><div class="dl">Type</div><div class="dv">${s.is_virtual ? 'Virtual Machine' : 'Physical'}</div></div>
      <div class="detail-item"><div class="dl">Hypervisor</div><div class="dv">${esc(s.hypervisor || 'N/A')}</div></div>
      <div class="detail-item"><div class="dl">CPU</div><div class="dv">${esc(s.cpu_model || '-')} (${s.cpu_cores || '-'} cores)</div></div>
      <div class="detail-item"><div class="dl">CPU Usage</div><div class="dv">${s.cpu_usage != null ? s.cpu_usage + '%' : '-'}</div></div>
      <div class="detail-item"><div class="dl">RAM</div><div class="dv">${s.ram_used_gb != null ? s.ram_used_gb.toFixed(1) : '-'} / ${s.ram_total_gb != null ? s.ram_total_gb.toFixed(1) : '-'} GB (${ramPct}%)</div></div>
      <div class="detail-item"><div class="dl">Last Patch Date</div><div class="dv">${fmtDate(s.last_patch_date)}</div></div>
      <div class="detail-item"><div class="dl">Missing Critical Updates</div><div class="dv"><span class="badge ${s.missing_critical_updates > 0 ? 'badge-red' : 'badge-green'}">${s.missing_critical_updates || 0}</span></div></div>
      <div class="detail-item"><div class="dl">WSUS Server</div><div class="dv">${esc(s.wsus_server || '-')}</div></div>
      <div class="detail-item"><div class="dl">Reboot Pending</div><div class="dv"><span class="badge ${s.reboot_pending ? 'badge-yellow' : 'badge-green'}">${s.reboot_pending ? 'Yes' : 'No'}</span></div></div>
      <div class="detail-item"><div class="dl">Antivirus</div><div class="dv">${esc(s.antivirus_product || '-')}</div></div>
      <div class="detail-item"><div class="dl">AV Status</div><div class="dv"><span class="badge ${avOk ? 'badge-green' : 'badge-red'}">${esc(s.antivirus_status || '-')}</span></div></div>
      <div class="detail-item"><div class="dl">BitLocker</div><div class="dv">${esc(s.bitlocker_status || '-')}</div></div>
      <div class="detail-item"><div class="dl">RDP</div><div class="dv"><span class="badge ${rdpBadge}">${rdpLabel}</span></div></div>
      <div class="detail-item"><div class="dl">Last Admin Login</div><div class="dv">${fmtDate(s.last_admin_login)}</div></div>
      <div class="detail-item"><div class="dl">Last User Login</div><div class="dv">${fmtDate(s.last_user_login)}</div></div>
      <div class="detail-item"><div class="dl">Security Scan</div><div class="dv">${fmtDate(s.last_security_scan)}</div></div>
      <div class="detail-item"><div class="dl">Critical Events (24h)</div><div class="dv"><span class="badge ${s.critical_events_24h > 0 ? 'badge-red' : 'badge-green'}">${s.critical_events_24h || 0}</span></div></div>
      <div class="detail-item"><div class="dl">Cluster Health</div><div class="dv">${esc(s.cluster_health || '-')}</div></div>
      <div class="detail-item"><div class="dl">Replication Health</div><div class="dv">${esc(s.replication_health || '-')}</div></div>
    </div>

    <div class="detail-tabs" id="detailTabs">
      <button class="detail-tab-btn active" data-dtab="dt-net">Network</button>
      <button class="detail-tab-btn" data-dtab="dt-disks">Disks</button>
      <button class="detail-tab-btn" data-dtab="dt-roles">Roles & Features</button>
      <button class="detail-tab-btn" data-dtab="dt-services">Services</button>
      <button class="detail-tab-btn" data-dtab="dt-admins">Local Admins</button>
      <button class="detail-tab-btn" data-dtab="dt-updates">Missing Updates</button>
      <button class="detail-tab-btn" data-dtab="dt-events">Event Errors</button>
      <button class="detail-tab-btn" data-dtab="dt-firewall">Firewall Rules</button>
      <button class="detail-tab-btn" data-dtab="dt-policies">Local Policies</button>
      <button class="detail-tab-btn" data-dtab="dt-logbook">Logbook</button>
    </div>`;

    // Network tab
    html += `<div class="detail-tab-content active" id="dt-net">`;
    if (s.ip_addresses && s.ip_addresses.length) {
      html += `<table class="mini-table"><thead><tr><th>Adapter</th><th>IP Address</th><th>Subnet</th><th>MAC</th><th>Speed</th></tr></thead><tbody>`;
      for (const ip of s.ip_addresses) {
        html += `<tr><td>${esc(ip.adapter_name || '-')}</td><td>${esc(ip.ip_address || '-')}</td><td>${esc(ip.subnet_mask || '-')}</td><td>${esc(ip.mac_address || '-')}</td><td>${ip.speed_mbps ? ip.speed_mbps + ' Mbps' : '-'}</td></tr>`;
      }
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No network data</p>'; }
    html += `</div>`;

    // Filter out System Reserved from disk display
    const visibleDisks = (s.disks || []).filter(d => (d.volume_label || '').toLowerCase() !== 'system reserved');

    // Disks tab (merged with disk trends)
    html += `<div class="detail-tab-content" id="dt-disks">`;
    if (visibleDisks.length) {
      html += `<table class="mini-table"><thead><tr><th>Drive</th><th>Label</th><th>Size</th><th>Free</th><th>Usage</th><th>FS</th></tr></thead><tbody>`;
      for (const d of visibleDisks) {
        const usedPct = d.size_gb ? Math.round(((d.size_gb - d.free_gb) / d.size_gb) * 100) : 0;
        const barColor = usedPct > 90 ? 'var(--danger)' : usedPct > 75 ? 'var(--warning)' : 'var(--success)';
        html += `<tr><td>${esc(d.drive_letter || '-')}</td><td>${esc(d.volume_label || '-')}</td><td>${d.size_gb != null ? d.size_gb.toFixed(1) + ' GB' : '-'}</td><td>${d.free_gb != null ? d.free_gb.toFixed(1) + ' GB' : '-'}</td>
        <td><div>${usedPct}%</div><div class="disk-bar-wrap"><div class="disk-bar-fill" style="width:${usedPct}%;background:${barColor};"></div></div></td>
        <td>${esc(d.file_system || '-')}</td></tr>`;
      }
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No disk data</p>'; }
    html += `<div style="margin-top:20px;"><h3 style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:12px;">Disk Trends (30 days)</h3><div class="charts-grid" id="dtDiskCharts"><div style="text-align:center;padding:16px;color:var(--text3);"><div class="spinner"></div></div></div></div>`;
    html += `</div>`;

    // Roles tab
    html += `<div class="detail-tab-content" id="dt-roles">`;
    if (s.roles && s.roles.length) {
      html += `<table class="mini-table"><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>`;
      for (const r of s.roles) html += `<tr><td>${esc(r.name || '-')}</td><td>${esc(r.type || '-')}</td></tr>`;
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No roles/features data</p>'; }
    html += `</div>`;

    // Services tab
    html += `<div class="detail-tab-content" id="dt-services">`;
    if (s.services && s.services.length) {
      html += `<table class="mini-table"><thead><tr><th>Name</th><th>Display Name</th><th>Status</th><th>Start Type</th></tr></thead><tbody>`;
      for (const sv of s.services) {
        const statusBadge = sv.status === 'Running' ? 'badge-green' : sv.status === 'Stopped' ? 'badge-red' : 'badge-gray';
        html += `<tr><td>${esc(sv.name || '-')}</td><td>${esc(sv.display_name || '-')}</td><td><span class="badge ${statusBadge}">${esc(sv.status || '-')}</span></td><td>${esc(sv.start_type || '-')}</td></tr>`;
      }
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No services data</p>'; }
    html += `</div>`;

    // Local admins tab
    html += `<div class="detail-tab-content" id="dt-admins">`;
    if (s.local_admins && s.local_admins.length) {
      html += `<table class="mini-table"><thead><tr><th>Account</th><th>Type</th></tr></thead><tbody>`;
      for (const a of s.local_admins) html += `<tr><td>${esc(a.account_name || '-')}</td><td>${esc(a.account_type || '-')}</td></tr>`;
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No local admin data</p>'; }
    html += `</div>`;

    // Missing updates tab
    html += `<div class="detail-tab-content" id="dt-updates">`;
    if (s.missing_updates && s.missing_updates.length) {
      html += `<table class="mini-table"><thead><tr><th>KB</th><th>Title</th><th>Severity</th></tr></thead><tbody>`;
      for (const u of s.missing_updates) {
        const sevBadge = (u.severity || '').toLowerCase() === 'critical' ? 'badge-red' : (u.severity || '').toLowerCase() === 'important' ? 'badge-yellow' : 'badge-gray';
        html += `<tr><td>${esc(u.kb_id || '-')}</td><td>${esc(u.title || '-')}</td><td><span class="badge ${sevBadge}">${esc(u.severity || '-')}</span></td></tr>`;
      }
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3);padding:16px;">All updates installed</p>'; }
    html += `</div>`;

    // Event errors tab
    html += `<div class="detail-tab-content" id="dt-events">`;
    if (s.event_errors && s.event_errors.length) {
      html += `<table class="mini-table"><thead><tr><th>Log</th><th>Event ID</th><th>Source</th><th>Time</th><th>Message</th></tr></thead><tbody>`;
      for (const e of s.event_errors) html += `<tr><td>${esc(e.log_name || '-')}</td><td>${e.event_id || '-'}</td><td>${esc(e.source || '-')}</td><td>${fmtDate(e.time_created)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(e.message || '')}">${esc(e.message || '-')}</td></tr>`;
      html += `</tbody></table>`;
    } else { html += '<p style="color:var(--text3)">No critical events in last 24h</p>'; }
    html += `</div>`;

    // Firewall rules tab
    html += `<div class="detail-tab-content" id="dt-firewall">`;
    if (s.firewall_rules && s.firewall_rules.length) {
      // Build unique rule sources for filter
      const sources = [...new Set(s.firewall_rules.map(r => r.rule_source || 'Unknown'))].sort();
      html += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <input type="text" class="search-input" id="dtFwSearch" placeholder="Search firewall rules..." style="width:240px;">
        <select class="search-input" id="dtFwSourceFilter" style="width:180px;">
          <option value="">All Sources</option>
          ${sources.map(src => `<option value="${esc(src)}">${esc(src)}</option>`).join('')}
        </select>
      </div>`;
      html += `<div style="max-height:400px;overflow-y:auto;"><table class="mini-table"><thead><tr><th>Rule</th><th>Direction</th><th>Action</th><th>Protocol</th><th>Local Port</th><th>Remote Address</th><th>Profile</th><th>Source</th><th>Enabled</th></tr></thead><tbody id="dtFwBody">`;
      for (const r of s.firewall_rules) {
        const actionBadge = (r.action || '').toLowerCase() === 'allow' ? 'badge-green' : 'badge-red';
        const dirBadge = (r.direction || '').toLowerCase() === 'inbound' ? 'badge-blue' : 'badge-gray';
        html += `<tr data-source="${esc(r.rule_source || 'Unknown')}">
          <td>${esc(r.name || '-')}</td>
          <td><span class="badge ${dirBadge}">${esc(r.direction || '-')}</span></td>
          <td><span class="badge ${actionBadge}">${esc(r.action || '-')}</span></td>
          <td>${esc(r.protocol || '-')}</td>
          <td>${esc(r.local_port || '*')}</td>
          <td>${esc(r.remote_address || '*')}</td>
          <td>${esc(r.profile || '-')}</td>
          <td>${esc(r.rule_source || '-')}</td>
          <td><span class="badge ${r.enabled ? 'badge-green' : 'badge-gray'}">${r.enabled ? 'Yes' : 'No'}</span></td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    } else { html += '<p style="color:var(--text3)">No firewall rules</p>'; }
    html += `</div>`;

    // Local policies tab
    html += `<div class="detail-tab-content" id="dt-policies">`;
    if (s.local_policies && s.local_policies.length) {
      html += `<div style="margin-bottom:12px;"><input type="text" class="search-input" id="dtPolSearch" placeholder="Search policies..." style="width:240px;"></div>`;
      html += `<div style="max-height:400px;overflow-y:auto;"><table class="mini-table"><thead><tr><th>Category</th><th>Policy</th><th>Setting</th></tr></thead><tbody id="dtPolBody">`;
      for (const p of s.local_policies) {
        html += `<tr><td>${esc(p.category || '-')}</td><td>${esc(p.policy_name || '-')}</td><td>${esc(p.setting || '-')}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    } else { html += '<p style="color:var(--text3)">No local policies</p>'; }
    html += `</div>`;

    // Logbook tab
    html += `<div class="detail-tab-content" id="dt-logbook">`;
    html += `<div id="logbookEntries"><div style="text-align:center;padding:16px;color:var(--text3);"><div class="spinner"></div></div></div>`;
    html += `<div id="logbookPagination" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 0;"></div>`;
    html += `</div>`;

    container.innerHTML = html;

    // Wire detail tabs
    container.querySelectorAll('.detail-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const panel = container.querySelector('#' + btn.dataset.dtab);
        if (panel) panel.classList.add('active');
      });
    });

    // Auto-load disk trends when Disks tab is first shown
    loadServerDiskTrends(s.hostname, container);

    // Wire firewall search + source filter
    const fwSearch = container.querySelector('#dtFwSearch');
    const fwSourceFilter = container.querySelector('#dtFwSourceFilter');
    if (fwSearch && s.firewall_rules) {
      const filterFw = () => {
        const q = fwSearch.value.toLowerCase().trim();
        const src = fwSourceFilter ? fwSourceFilter.value : '';
        container.querySelectorAll('#dtFwBody tr').forEach(tr => {
          const text = tr.textContent.toLowerCase();
          const rowSrc = tr.dataset.source || '';
          const matchQ = !q || text.includes(q);
          const matchSrc = !src || rowSrc === src;
          tr.style.display = matchQ && matchSrc ? '' : 'none';
        });
      };
      fwSearch.addEventListener('input', filterFw);
      if (fwSourceFilter) fwSourceFilter.addEventListener('change', filterFw);
    }

    // Wire local policies search
    const polSearch = container.querySelector('#dtPolSearch');
    if (polSearch) {
      polSearch.addEventListener('input', () => {
        const q = polSearch.value.toLowerCase().trim();
        container.querySelectorAll('#dtPolBody tr').forEach(tr => {
          tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    // Logbook
    logbookPage = 1;
    loadLogbook(s.hostname, container, 1);

    // Maintenance mode buttons
    const maintStartBtn = container.querySelector('#maintStartBtn');
    const maintFormWrap = container.querySelector('#maintFormWrap');
    const maintEndBtn = container.querySelector('#maintEndBtn');

    if (maintStartBtn) {
      maintStartBtn.addEventListener('click', () => {
        maintStartBtn.style.display = 'none';
        const lqBtn = container.querySelector('#logbookQuickBtn');
        if (lqBtn) lqBtn.style.display = 'none';
        maintFormWrap.style.display = 'flex';
      });
      container.querySelector('#maintCancelBtn').addEventListener('click', () => {
        maintFormWrap.style.display = 'none';
        maintStartBtn.style.display = '';
        const lqBtn = container.querySelector('#logbookQuickBtn');
        if (lqBtn) lqBtn.style.display = '';
      });
      container.querySelector('#maintConfirmBtn').addEventListener('click', async () => {
        const hours = container.querySelector('#maintHours').value;
        const comment = container.querySelector('#maintComment').value.trim();
        try {
          await fetch('/api/servers/' + encodeURIComponent(s.hostname) + '/maintenance', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours, comment })
          });
          openServerDetail(s.hostname);
        } catch (e) { console.error(e); }
      });
    }

    // Logbook quick-add button
    const logbookQuickBtn = container.querySelector('#logbookQuickBtn');
    const logbookQuickForm = container.querySelector('#logbookQuickForm');
    if (logbookQuickBtn) {
      logbookQuickBtn.addEventListener('click', () => {
        logbookQuickBtn.style.display = 'none';
        if (maintStartBtn) maintStartBtn.style.display = 'none';
        logbookQuickForm.style.display = '';
        container.querySelector('#logbookQuickInput').focus();
      });
      container.querySelector('#logbookQuickCancel').addEventListener('click', () => {
        logbookQuickForm.style.display = 'none';
        logbookQuickBtn.style.display = '';
        if (maintStartBtn) maintStartBtn.style.display = '';
      });
      const submitQuickLogbook = async () => {
        const input = container.querySelector('#logbookQuickInput');
        const comment = input.value.trim();
        if (!comment) return;
        try {
          await fetch('/api/servers/' + encodeURIComponent(s.hostname) + '/logbook', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
          });
          input.value = '';
          logbookQuickForm.style.display = 'none';
          logbookQuickBtn.style.display = '';
          if (maintStartBtn) maintStartBtn.style.display = '';
          loadLogbook(s.hostname, container, 1);
        } catch (e) { console.error(e); }
      };
      container.querySelector('#logbookQuickSubmit').addEventListener('click', submitQuickLogbook);
      container.querySelector('#logbookQuickInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitQuickLogbook(); });
    }

    if (maintEndBtn) {
      maintEndBtn.addEventListener('click', async () => {
        if (!confirm('End maintenance mode for ' + s.hostname + '?')) return;
        try {
          await fetch('/api/servers/' + encodeURIComponent(s.hostname) + '/maintenance', { method: 'DELETE' });
          openServerDetail(s.hostname);
        } catch (e) { console.error(e); }
      });
    }
  }

  async function loadServerDiskTrends(hostname, container) {
    const grid = container.querySelector('#dtDiskCharts');
    grid.innerHTML = '<div style="text-align:center;padding:24px;"><div class="spinner"></div></div>';

    try {
      const r = await fetch('/api/servers/' + encodeURIComponent(hostname) + '/disk-history?days=30');
      const history = await r.json();
      if (!history.length) { grid.innerHTML = '<p style="text-align:center;color:var(--text3);padding:24px;">No disk history data yet</p>'; return; }

      const drives = {};
      for (const h of history) {
        if (!drives[h.drive_letter]) drives[h.drive_letter] = [];
        drives[h.drive_letter].push(h);
      }

      grid.innerHTML = '';
      for (const [drive, data] of Object.entries(drives)) {
        const card = document.createElement('div');
        card.className = 'chart-card';
        card.innerHTML = `<h3>${esc(drive)}</h3><div class="chart-canvas-wrap"><canvas></canvas></div>`;
        grid.appendChild(card);

        const colors = getChartColors();
        const labels = data.map(d => d.recorded_at ? fmtDate(d.recorded_at) : '');
        const freeData = data.map(d => d.free_gb);
        const sizeGb = data[0] ? data[0].size_gb : 100;

        // Determine line color based on the latest free value
        const latestFree = freeData[freeData.length - 1] || 0;
        const latestPct = sizeGb > 0 ? (latestFree / sizeGb) * 100 : 100;
        let lineColor = colors.success;
        if (latestPct < 5 || latestFree < 5) lineColor = colors.danger;
        else if (latestPct < 10 || latestFree < 10) lineColor = colors.warning;

        // Per-point colors for segment coloring
        function segColor(ctx) {
          const idx = ctx.p1DataIndex;
          const val = freeData[idx];
          const pct = sizeGb > 0 ? (val / sizeGb) * 100 : 100;
          if (pct < 5 || val < 5) return colors.danger;
          if (pct < 10 || val < 10) return colors.warning;
          return colors.success;
        }

        new Chart(card.querySelector('canvas'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Free GB', data: freeData, borderColor: lineColor, backgroundColor: lineColor + '20', fill: true, tension: .3, segment: { borderColor: segColor, backgroundColor: ctx => segColor(ctx) + '20' } }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: colors.text, font: { size: 11 } } } },
            scales: {
              x: { ticks: { color: colors.text, maxTicksLimit: 8 }, grid: { color: colors.grid } },
              y: { ticks: { color: colors.text }, grid: { color: colors.grid }, title: { display: true, text: 'GB', color: colors.text } }
            }
          }
        });
      }
    } catch (e) {
      grid.innerHTML = '<p style="text-align:center;color:var(--text3)">Error loading disk trends</p>';
    }
  }

  const LOGBOOK_PER_PAGE = 10;
  let logbookPage = 1;
  let logbookAllEntries = [];

  async function loadLogbook(hostname, container, page) {
    const el = container.querySelector('#logbookEntries');
    const pagEl = container.querySelector('#logbookPagination');
    try {
      const r = await fetch('/api/servers/' + encodeURIComponent(hostname) + '/logbook');
      logbookAllEntries = await r.json();
      if (page !== undefined) logbookPage = page;
      renderLogbookPage(hostname, container);
    } catch (e) {
      el.innerHTML = '<p style="color:var(--text3)">Error loading logbook</p>';
      if (pagEl) pagEl.innerHTML = '';
    }
  }

  function renderLogbookPage(hostname, container) {
    const el = container.querySelector('#logbookEntries');
    const pagEl = container.querySelector('#logbookPagination');
    const entries = logbookAllEntries;
    const total = entries.length;
    const totalPages = Math.max(1, Math.ceil(total / LOGBOOK_PER_PAGE));
    if (logbookPage > totalPages) logbookPage = totalPages;
    if (logbookPage < 1) logbookPage = 1;

    if (!total) {
      el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:16px;">No logbook entries yet</p>';
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    const start = (logbookPage - 1) * LOGBOOK_PER_PAGE;
    const pageEntries = entries.slice(start, start + LOGBOOK_PER_PAGE);

    el.innerHTML = pageEntries.map(e => `
      <div class="logbook-entry">
        <div class="logbook-meta">
          <span class="logbook-author">${esc(e.author)}</span>
          <span class="logbook-date">${fmtDate(e.created_at)}</span>
          <button class="logbook-delete" data-id="${e.id}" title="Delete entry">&times;</button>
        </div>
        <div class="logbook-text">${esc(e.comment)}</div>
      </div>
    `).join('');
    el.querySelectorAll('.logbook-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this logbook entry?')) return;
        await fetch('/api/servers/' + encodeURIComponent(hostname) + '/logbook/' + btn.dataset.id, { method: 'DELETE' });
        loadLogbook(hostname, container, logbookPage);
      });
    });

    // Pagination controls
    if (pagEl) {
      if (totalPages <= 1) {
        pagEl.innerHTML = `<span style="color:var(--text3);font-size:12px;">${total} entries</span>`;
      } else {
        let ph = `<span style="color:var(--text3);font-size:12px;">${total} entries &mdash; Page ${logbookPage} of ${totalPages}</span>&nbsp;`;
        ph += `<button class="btn btn-sm" ${logbookPage <= 1 ? 'disabled' : ''} data-lbpage="1" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&laquo;</button>`;
        ph += `<button class="btn btn-sm" ${logbookPage <= 1 ? 'disabled' : ''} data-lbpage="${logbookPage - 1}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&lsaquo;</button>`;
        ph += `<button class="btn btn-sm" ${logbookPage >= totalPages ? 'disabled' : ''} data-lbpage="${logbookPage + 1}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&rsaquo;</button>`;
        ph += `<button class="btn btn-sm" ${logbookPage >= totalPages ? 'disabled' : ''} data-lbpage="${totalPages}" style="background:var(--card2);color:var(--text);border:1px solid var(--border);">&raquo;</button>`;
        pagEl.innerHTML = ph;
        pagEl.querySelectorAll('[data-lbpage]').forEach(btn => {
          btn.addEventListener('click', () => {
            logbookPage = parseInt(btn.dataset.lbpage, 10);
            renderLogbookPage(hostname, container);
          });
        });
      }
    }
  }

  function setupModalClose() {
    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('serverModal').classList.remove('open');
    });
    document.getElementById('serverModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });

    // KPI overlay
    document.getElementById('kpiOverlayClose').addEventListener('click', () => {
      document.getElementById('kpiOverlay').classList.remove('open');
    });
    document.getElementById('kpiOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  }

  // KPI overlay — show filtered servers for any dashboard card
  window.showKpiOverlay = async function(type) {
    const modal = document.getElementById('kpiOverlay');
    const body = document.getElementById('kpiOverlayBody');
    const title = document.getElementById('kpiOverlayTitle');
    body.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    modal.classList.add('open');

    const titles = {
      domains: 'Total Domains',
      total: 'All Servers',
      status: 'Server Status',
      reboot: 'Reboot Pending',
      updates: 'Missing Updates',
      events: 'Critical Events',
      disk: 'Disk Space Alerts',
      services: 'Service Issues',
      maintenance: 'In Maintenance'
    };
    title.textContent = titles[type] || 'Details';

    try {
      const r = await fetch('/api/servers?limit=2000');
      const resp = await r.json();
      const allServers = resp.data || resp.servers || resp;
      const stats = dashboardStats;

      let servers = [];
      switch (type) {
        case 'domains': {
          // Group all servers by domain
          const byDomain = {};
          for (const s of allServers) {
            const d = s.domain_or_workgroup || 'UNKNOWN';
            if (!byDomain[d]) byDomain[d] = [];
            byDomain[d].push(s);
          }
          const domainNames = Object.keys(byDomain).sort();
          let html = '';
          for (const domain of domainNames) {
            const srvs = byDomain[domain];
            const onlineCount = srvs.filter(s => s.last_heartbeat && new Date(s.last_heartbeat + 'Z') > new Date(Date.now() - 180000)).length;
            html += renderKpiDomainGroup(domain, srvs, onlineCount);
          }
          body.innerHTML = html || '<div class="empty-state"><p>No domain data.</p></div>';
          wireKpiOverlayEvents(body, modal);
          return;
        }
        case 'total':
          servers = allServers;
          break;
        case 'status': {
          const cutoff = Date.now() - 180000;
          const online = allServers.filter(s => s.last_heartbeat && new Date(s.last_heartbeat + 'Z') > new Date(cutoff));
          const offline = allServers.filter(s => s.last_heartbeat && new Date(s.last_heartbeat + 'Z') <= new Date(cutoff));
          const noHb = allServers.filter(s => !s.last_heartbeat);

          let html = '';
          if (offline.length) html += `<h3 style="font-size:14px;color:var(--danger);margin:0 0 8px 0;">Offline (${offline.length})</h3>` + renderKpiServerTable(offline);
          if (online.length) html += `<h3 style="font-size:14px;color:var(--success);margin:16px 0 8px 0;">Online (${online.length})</h3>` + renderKpiServerTable(online);
          if (noHb.length) html += `<h3 style="font-size:14px;color:var(--text3);margin:16px 0 8px 0;">No Heartbeat (${noHb.length})</h3>` + renderKpiServerTable(noHb);
          body.innerHTML = html || '<div class="empty-state"><p>No status data.</p></div>';
          wireKpiOverlayEvents(body, modal);
          return;
        }
        case 'reboot':
          servers = allServers.filter(s => s.reboot_pending);
          break;
        case 'updates':
          servers = allServers.filter(s => s.missing_critical_updates > 0);
          break;
        case 'events':
          servers = allServers.filter(s => s.critical_events_24h > 0);
          break;
        case 'disk':
          if (stats && stats.diskAlerts && stats.diskAlerts.length) {
            let html = '<div class="table-scroll"><table class="data-table" style="font-size:12px;"><thead><tr><th>Hostname</th><th>Domain</th><th>Drive</th><th>Free</th><th>Usage</th><th>Level</th></tr></thead><tbody>';
            for (const da of stats.diskAlerts) {
              html += `<tr style="cursor:pointer;" class="kpi-srv-row" data-hostname="${esc(da.hostname)}">
                <td><strong>${esc(da.hostname)}</strong></td>
                <td>${esc(da.domain_or_workgroup || '-')}</td>
                <td>${esc(da.drive)}</td>
                <td>${da.free_gb} GB</td>
                <td><div style="background:var(--bg2);border-radius:4px;height:8px;width:80px;"><div style="background:${da.level === 'critical' ? 'var(--danger)' : 'var(--warning)'};height:100%;border-radius:4px;width:${100 - da.pct}%;"></div></div></td>
                <td><span class="badge ${da.level === 'critical' ? 'badge-red' : 'badge-yellow'}">${da.pct}% free</span></td>
              </tr>`;
            }
            html += '</tbody></table></div>';
            body.innerHTML = html;
            wireKpiOverlayEvents(body, modal);
            return;
          }
          servers = [];
          break;
        case 'services':
          servers = allServers.filter(s => s.stopped_services > 0);
          break;
        case 'maintenance':
          servers = allServers.filter(s => s.maintenance_mode);
          break;
        default:
          servers = allServers;
      }

      if (!servers.length) {
        body.innerHTML = '<div class="empty-state"><p>No servers match this filter.</p></div>';
        return;
      }
      body.innerHTML = renderKpiServerTable(servers, type);
      wireKpiOverlayEvents(body, modal);

    } catch (e) {
      body.innerHTML = '<p style="padding:20px;color:var(--danger);">Error loading data.</p>';
    }
  };

  function renderKpiServerTable(servers, type) {
    let extraCol = '';
    let extraHeader = '';
    switch (type) {
      case 'reboot': extraHeader = '<th>Status</th>'; break;
      case 'updates': extraHeader = '<th>Missing</th>'; break;
      case 'events': extraHeader = '<th>Events</th>'; break;
      case 'services': extraHeader = '<th>Stopped</th>'; break;
      case 'maintenance': extraHeader = '<th>Until</th>'; break;
    }

    let html = `<div class="table-scroll"><table class="data-table" style="font-size:12px;"><thead><tr><th>Hostname</th><th>Domain</th><th>OS</th>${extraHeader}</tr></thead><tbody>`;
    for (const s of servers) {
      switch (type) {
        case 'reboot': extraCol = '<td><span class="badge badge-yellow">Pending</span></td>'; break;
        case 'updates': extraCol = `<td><span class="badge badge-red">${s.missing_critical_updates}</span></td>`; break;
        case 'events': extraCol = `<td><span class="badge badge-red">${s.critical_events_24h}</span></td>`; break;
        case 'services': extraCol = `<td><span class="badge badge-yellow">${s.stopped_services}</span></td>`; break;
        case 'maintenance': extraCol = `<td>${s.maintenance_until ? fmtDate(s.maintenance_until) : 'Indefinite'}</td>`; break;
        default: extraCol = '';
      }
      html += `<tr style="cursor:pointer;" class="kpi-srv-row" data-hostname="${esc(s.hostname)}">
        <td><strong>${esc(s.hostname)}</strong></td>
        <td>${esc(s.domain_or_workgroup || '-')}</td>
        <td>${esc(s.os_edition || '-')}</td>
        ${extraCol}
      </tr>`;
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderKpiDomainGroup(domain, srvs, onlineCount) {
    let html = `<div class="panel" style="margin-bottom:12px;">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;cursor:pointer;" class="kpi-group-hdr">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">🏢</span>
          <strong style="font-size:15px;">${esc(domain)}</strong>
          <span class="badge badge-blue" style="font-size:11px;">${srvs.length} servers</span>
          ${onlineCount > 0 ? `<span class="badge badge-green" style="font-size:11px;">${onlineCount} online</span>` : ''}
        </div>
        <span style="font-size:14px;transition:transform .2s;color:var(--text3);" class="kpi-group-chev">&#9654;</span>
      </div>
      <div class="kpi-group-detail" style="display:none;">
        <div class="table-scroll">
          <table class="data-table" style="font-size:12px;"><thead><tr><th>Hostname</th><th>OS</th><th>Type</th><th>CPU</th><th>Patches</th><th>AV</th></tr></thead><tbody>`;
    for (const s of srvs) {
      const avOk = s.antivirus_status && ['active','enabled','up to date'].includes((s.antivirus_status||'').toLowerCase());
      html += `<tr style="cursor:pointer;" class="kpi-srv-row" data-hostname="${esc(s.hostname)}">
        <td><strong>${esc(s.hostname)}</strong></td>
        <td>${esc(s.os_edition || '-')}</td>
        <td>${s.is_virtual ? 'Virtual' : 'Physical'}</td>
        <td>${s.cpu_usage != null ? s.cpu_usage + '%' : '-'}</td>
        <td>${s.missing_critical_updates > 0 ? `<span class="badge badge-red">${s.missing_critical_updates}</span>` : '<span class="badge badge-green">0</span>'}</td>
        <td><span class="badge ${avOk ? 'badge-green' : 'badge-red'}">${esc(s.antivirus_status || '-')}</span></td>
      </tr>`;
    }
    html += `</tbody></table></div></div></div>`;
    return html;
  }

  function wireKpiOverlayEvents(body, modal) {
    // Expand/collapse groups
    body.querySelectorAll('.kpi-group-hdr').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const detail = hdr.nextElementSibling;
        const chev = hdr.querySelector('.kpi-group-chev');
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : 'block';
        chev.style.transform = isOpen ? '' : 'rotate(90deg)';
      });
    });
    // Row clicks → open server detail
    body.querySelectorAll('.kpi-srv-row').forEach(row => {
      row.addEventListener('click', () => {
        modal.classList.remove('open');
        openServerDetail(row.dataset.hostname);
      });
    });
  }

  // =========================================================================
  //  MAINTENANCE VIEW (Main Tab)
  // =========================================================================
  let maintenanceData = [];
  let maintenanceLoaded = false;

  async function loadMaintenanceView() {
    const content = document.getElementById('maintenanceContent');
    if (!maintenanceLoaded) {
      content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    }

    try {
      const r = await fetch('/api/servers?limit=2000');
      const resp = await r.json();
      const allServers = resp.data || resp.servers || resp;

      maintenanceData = allServers.filter(s => s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date());

      // Populate domain filter
      const domainFilter = document.getElementById('maintDomainFilter');
      const domains = [...new Set(allServers.map(s => s.domain_or_workgroup).filter(Boolean))].sort();
      const curDom = domainFilter.value;
      domainFilter.innerHTML = '<option value="">All Domains</option>' +
        domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
      domainFilter.value = curDom;

      renderMaintenanceView(maintenanceData);

      if (!maintenanceLoaded) {
        domainFilter.addEventListener('change', filterMaintenanceView);
        document.getElementById('maintSearch').addEventListener('input', filterMaintenanceView);
        maintenanceLoaded = true;
      }
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><p>Error loading maintenance data.</p></div>';
    }
  }

  function filterMaintenanceView() {
    const domain = document.getElementById('maintDomainFilter')?.value || '';
    const q = document.getElementById('maintSearch').value.toLowerCase().trim();
    let filtered = maintenanceData;
    if (domain) filtered = filtered.filter(s => s.domain_or_workgroup === domain);
    if (q) filtered = filtered.filter(s =>
      s.hostname.toLowerCase().includes(q) ||
      (s.maintenance_comment || '').toLowerCase().includes(q) ||
      (s.maintenance_set_by || '').toLowerCase().includes(q)
    );
    renderMaintenanceView(filtered);
  }

  function renderMaintenanceView(servers) {
    const content = document.getElementById('maintenanceContent');
    if (!servers.length) {
      content.innerHTML = '<div class="empty-state"><p>No servers currently in maintenance.</p></div>';
      return;
    }
    let html = `<div class="table-scroll"><table class="data-table" style="font-size:13px;">
      <thead><tr><th>Hostname</th><th>Domain</th><th>Until</th><th>Remaining</th><th>Comment</th><th>Set By</th><th></th></tr></thead><tbody>`;
    for (const s of servers) {
      const until = new Date(s.maintenance_until);
      const remaining = Math.max(0, Math.ceil((until - new Date()) / 60000));
      const hrs = Math.floor(remaining / 60);
      const mins = remaining % 60;
      html += `<tr>
        <td style="cursor:pointer;" class="maint-srv-link" data-hostname="${esc(s.hostname)}"><strong>${esc(s.hostname)}</strong></td>
        <td>${esc(s.domain_or_workgroup || '-')}</td>
        <td>${fmtDate(s.maintenance_until)}</td>
        <td><span class="badge badge-yellow">${hrs}h ${mins}m</span></td>
        <td>${esc(s.maintenance_comment || '-')}</td>
        <td>${esc(s.maintenance_set_by || '-')}</td>
        <td><button class="btn btn-sm maint-end-btn" data-hostname="${esc(s.hostname)}" style="background:var(--danger);color:#fff;border:none;padding:4px 10px;border-radius:var(--radius);cursor:pointer;font-size:11px;">End</button></td>
      </tr>`;
    }
    html += '</tbody></table></div>';
    content.innerHTML = html;

    // Wire hostname clicks to open server detail
    content.querySelectorAll('.maint-srv-link').forEach(el => {
      el.addEventListener('click', () => openServerDetail(el.dataset.hostname));
    });

    // Wire end-maintenance buttons
    content.querySelectorAll('.maint-end-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hostname = btn.dataset.hostname;
        if (!confirm('End maintenance mode for ' + hostname + '?')) return;
        try {
          await fetch('/api/servers/' + encodeURIComponent(hostname) + '/maintenance', { method: 'DELETE' });
          loadMaintenanceView();
        } catch (e) { console.error(e); }
      });
    });
  }

  // =========================================================================
  //  GLOBAL LOGBOOK
  // =========================================================================
  let globalLogbookLoaded = false;
  let globalLogbookData = [];

  async function loadGlobalLogbook() {
    const content = document.getElementById('globalLogbookContent');
    if (!globalLogbookLoaded) {
      content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    }

    try {
      const r = await fetch('/api/logbook');
      globalLogbookData = await r.json();

      // Populate server filter
      const serverFilter = document.getElementById('logbookServerFilter');
      const hostnames = [...new Set(globalLogbookData.map(e => e.hostname))].sort();
      const currentVal = serverFilter.value;
      serverFilter.innerHTML = '<option value="">All Servers</option>' +
        hostnames.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
      serverFilter.value = currentVal;

      renderGlobalLogbook(globalLogbookData);

      // Populate domain filter for logbook
      const logDomainFilter = document.getElementById('logbookDomainFilter');
      if (logDomainFilter) {
        const logDomains = [...new Set(globalLogbookData.map(e => e.domain_or_workgroup).filter(Boolean))].sort();
        const curDom = logDomainFilter.value;
        logDomainFilter.innerHTML = '<option value="">All Domains</option>' +
          logDomains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
        logDomainFilter.value = curDom;
      }

      if (!globalLogbookLoaded) {
        serverFilter.addEventListener('change', filterGlobalLogbook);
        document.getElementById('logbookSearch').addEventListener('input', filterGlobalLogbook);
        if (logDomainFilter) logDomainFilter.addEventListener('change', filterGlobalLogbook);
        globalLogbookLoaded = true;
      }
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><p>Error loading logbook entries.</p></div>';
    }
  }

  function filterGlobalLogbook() {
    const domain = document.getElementById('logbookDomainFilter')?.value || '';
    const server = document.getElementById('logbookServerFilter').value;
    const q = document.getElementById('logbookSearch').value.toLowerCase().trim();
    let filtered = globalLogbookData;
    if (domain) filtered = filtered.filter(e => e.domain_or_workgroup === domain);
    if (server) filtered = filtered.filter(e => e.hostname === server);
    if (q) filtered = filtered.filter(e =>
      e.hostname.toLowerCase().includes(q) ||
      e.author.toLowerCase().includes(q) ||
      e.comment.toLowerCase().includes(q)
    );

    // Update server filter to only show servers in selected domain
    const serverFilter = document.getElementById('logbookServerFilter');
    const relevantEntries = domain ? globalLogbookData.filter(e => e.domain_or_workgroup === domain) : globalLogbookData;
    const hostnames = [...new Set(relevantEntries.map(e => e.hostname))].sort();
    const curServer = serverFilter.value;
    serverFilter.innerHTML = '<option value="">All Servers</option>' +
      hostnames.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
    if (hostnames.includes(curServer)) serverFilter.value = curServer;

    renderGlobalLogbook(filtered);
  }

  function renderGlobalLogbook(entries) {
    const content = document.getElementById('globalLogbookContent');
    if (!entries.length) {
      content.innerHTML = '<div class="empty-state"><p>No logbook entries found.</p></div>';
      return;
    }
    content.innerHTML = entries.map(e => `
      <div class="logbook-entry" style="cursor:pointer;" data-hostname="${esc(e.hostname)}">
        <div class="logbook-meta">
          <span class="logbook-author">${esc(e.hostname)}</span>
          <span style="color:var(--text2);">${esc(e.author)}</span>
          <span class="logbook-date">${fmtDate(e.created_at)}</span>
        </div>
        <div class="logbook-text">${esc(e.comment)}</div>
      </div>
    `).join('');
    content.querySelectorAll('.logbook-entry').forEach(el => {
      el.addEventListener('click', () => openServerDetail(el.dataset.hostname));
    });
  }

  // =========================================================================
  //  DOMAINS VIEW (Group Policies + DNS on separate sub-tabs)
  // =========================================================================
  let domainsGpoData = [];
  let domainsDnsData = [];
  let domainsLoaded = false;

  async function loadDomainsView() {
    if (domainsLoaded) return;

    const gpoContent = document.getElementById('domainsGpoContent');
    const dnsContent = document.getElementById('domainsDnsContent');
    gpoContent.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    dnsContent.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

    // Wire sub-tab switching
    document.querySelectorAll('#domainsSubTabs .detail-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#domainsSubTabs .detail-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('dtab-gpo').classList.toggle('active', btn.dataset.dtab === 'gpo');
        document.getElementById('dtab-dns').classList.toggle('active', btn.dataset.dtab === 'dns');
      });
    });

    try {
      const [gpoDomR, gpoR, dnsDomR, dnsR] = await Promise.all([
        fetch('/api/gpo/domains'), fetch('/api/gpo'),
        fetch('/api/dns/domains'), fetch('/api/dns')
      ]);
      const gpoDomains = await gpoDomR.json();
      domainsGpoData = await gpoR.json();
      const dnsDomains = await dnsDomR.json();
      domainsDnsData = await dnsR.json();

      // Merge domain lists
      const allDomains = [...new Set([...gpoDomains, ...dnsDomains])].sort();
      const domainSel = document.getElementById('domainsDomainFilter');
      domainSel.innerHTML = '<option value="">All Domains</option>' +
        allDomains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

      renderGpoTab(domainsGpoData);
      renderDnsTab(domainsDnsData);

      domainSel.addEventListener('change', filterDomainsView);
      document.getElementById('domainsSearch').addEventListener('input', filterDomainsView);

      domainsLoaded = true;
    } catch (e) {
      gpoContent.innerHTML = '<div class="empty-state"><p>Error loading domain data.</p></div>';
      dnsContent.innerHTML = '<div class="empty-state"><p>Error loading domain data.</p></div>';
    }
  }

  function filterDomainsView() {
    const domain = document.getElementById('domainsDomainFilter').value;
    const q = document.getElementById('domainsSearch').value.toLowerCase().trim();

    let filteredGpo = domainsGpoData;
    let filteredDns = domainsDnsData;

    if (domain) {
      filteredGpo = filteredGpo.filter(g => g.domain === domain);
      filteredDns = filteredDns.filter(z => z.domain === domain);
    }
    if (q) {
      filteredGpo = filteredGpo.filter(g =>
        (g.gpo_name || '').toLowerCase().includes(q) ||
        (g.gpo_guid || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.settings || []).some(s => (s.setting_name || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))
      );
      filteredDns = filteredDns.filter(z =>
        (z.zone_name || '').toLowerCase().includes(q) ||
        (z.zone_type || '').toLowerCase().includes(q) ||
        (z.records || []).some(r => (r.record_name || '').toLowerCase().includes(q) || (r.record_data || '').toLowerCase().includes(q) || (r.record_type || '').toLowerCase().includes(q))
      );
    }
    renderGpoTab(filteredGpo);
    renderDnsTab(filteredDns);
  }

  function renderGpoTab(gpos) {
    const content = document.getElementById('domainsGpoContent');
    if (!gpos.length) {
      content.innerHTML = '<div class="empty-state"><p>No group policies found.</p></div>';
      return;
    }

    const domainSet = new Set();
    gpos.forEach(g => domainSet.add(g.domain));
    const domainList = [...domainSet].sort();

    let html = '';
    for (const domain of domainList) {
      const domGpos = gpos.filter(g => g.domain === domain);

      html += `<div class="panel" style="margin-bottom:20px;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">🏢</span>
            <h2 style="margin:0;font-size:18px;">${esc(domain)}</h2>
          </div>
          <div style="font-size:12px;color:var(--text3);"><strong>${domGpos.length}</strong> GPOs</div>
        </div>
        <div style="padding:20px;">`;

      for (const gpo of domGpos) {
        const statusBadge = (gpo.gpo_status || '').toLowerCase().includes('all') ? 'badge-green'
          : (gpo.gpo_status || '').toLowerCase().includes('disabled') ? 'badge-red' : 'badge-yellow';

        html += `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
          <div style="padding:12px 16px;cursor:pointer;" class="gpo-header" data-gpo-id="${gpo.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:14px;">📋</span>
                <strong style="font-size:13px;">${esc(gpo.gpo_name || '-')}</strong>
                <span class="badge ${statusBadge}" style="font-size:11px;">${esc(gpo.gpo_status || '-')}</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text3);">
                ${gpo.modification_time ? '<span>Modified: ' + fmtDate(gpo.modification_time) + '</span>' : ''}
                <span style="font-size:14px;transition:transform .2s;" class="gpo-chevron">&#9654;</span>
              </div>
            </div>
            ${gpo.description ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;margin-left:24px;">${esc(gpo.description)}</div>` : ''}
          </div>
          <div class="gpo-detail" style="display:none;border-top:1px solid var(--border);padding:14px 16px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;font-size:12px;">
              <div><span style="color:var(--text3);">GUID:</span> <span style="font-family:monospace;">${esc(gpo.gpo_guid || '-')}</span></div>
              <div><span style="color:var(--text3);">Created:</span> ${fmtDate(gpo.creation_time)}</div>
              <div><span style="color:var(--text3);">WMI Filter:</span> ${esc(gpo.wmi_filter || 'None')}</div>
              <div><span style="color:var(--text3);">Modified:</span> ${fmtDate(gpo.modification_time)}</div>
            </div>`;

        if (gpo.links && gpo.links.length) {
          html += `<h4 style="font-size:11px;text-transform:uppercase;color:var(--text3);letter-spacing:.5px;margin-bottom:6px;">Links</h4>
            <table class="mini-table" style="margin-bottom:14px;"><thead><tr><th>Target</th><th>Enabled</th><th>Enforced</th></tr></thead><tbody>`;
          for (const link of gpo.links) {
            html += `<tr>
              <td>${esc(link.target || '-')}</td>
              <td><span class="badge ${link.link_enabled ? 'badge-green' : 'badge-red'}">${link.link_enabled ? 'Yes' : 'No'}</span></td>
              <td><span class="badge ${link.enforced ? 'badge-yellow' : 'badge-gray'}">${link.enforced ? 'Yes' : 'No'}</span></td>
            </tr>`;
          }
          html += `</tbody></table>`;
        }

        if (gpo.settings && gpo.settings.length) {
          const grouped = {};
          for (const s of gpo.settings) {
            const key = (s.area || 'Other') + ' / ' + (s.category || 'General');
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(s);
          }
          html += `<h4 style="font-size:11px;text-transform:uppercase;color:var(--text3);letter-spacing:.5px;margin-bottom:6px;">Settings (${gpo.settings.length})</h4>
            <div style="max-height:300px;overflow-y:auto;"><table class="mini-table"><thead><tr><th>Area / Category</th><th>Setting</th><th>Value</th></tr></thead><tbody>`;
          for (const [key, settings] of Object.entries(grouped)) {
            for (let j = 0; j < settings.length; j++) {
              const s = settings[j];
              html += `<tr>
                ${j === 0 ? `<td rowspan="${settings.length}" style="vertical-align:top;font-weight:500;">${esc(key)}</td>` : ''}
                <td>${esc(s.setting_name || '-')}</td>
                <td>${esc(s.setting_value || '-')}</td>
              </tr>`;
            }
          }
          html += `</tbody></table></div>`;
        } else {
          html += `<p style="color:var(--text3);font-size:12px;margin:0;">No settings configured</p>`;
        }

        html += `</div></div>`;
      }

      html += `</div></div>`;
    }

    content.innerHTML = html;

    content.querySelectorAll('.gpo-header').forEach(header => {
      header.addEventListener('click', () => {
        const detail = header.nextElementSibling;
        const chevron = header.querySelector('.gpo-chevron');
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
      });
    });
  }

  function renderDnsTab(zones) {
    const content = document.getElementById('domainsDnsContent');
    if (!zones.length) {
      content.innerHTML = '<div class="empty-state"><p>No DNS zones found.</p></div>';
      return;
    }

    const domainSet = new Set();
    zones.forEach(z => domainSet.add(z.domain));
    const domainList = [...domainSet].sort();

    let html = '';
    for (const domain of domainList) {
      const domZones = zones.filter(z => z.domain === domain);
      const totalRecords = domZones.reduce((s, z) => s + (z.records ? z.records.length : (z.record_count || 0)), 0);

      html += `<div class="panel" style="margin-bottom:20px;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">🏢</span>
            <h2 style="margin:0;font-size:18px;">${esc(domain)}</h2>
          </div>
          <div style="display:flex;gap:12px;font-size:12px;color:var(--text3);">
            <span><strong>${domZones.length}</strong> DNS zones</span>
            <span>•</span>
            <span><strong>${totalRecords}</strong> records</span>
          </div>
        </div>
        <div style="padding:20px;">`;

      for (const zone of domZones) {
        const typeBadge = zone.zone_type === 'Primary' ? 'badge-green' : zone.zone_type === 'Secondary' ? 'badge-blue' : 'badge-yellow';
        const recCount = zone.records ? zone.records.length : (zone.record_count || 0);

        html += `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
          <div style="padding:12px 16px;cursor:pointer;" class="dns-header" data-zone-id="${zone.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:14px;">🌐</span>
                <strong style="font-size:13px;">${esc(zone.zone_name || '-')}</strong>
                <span class="badge ${typeBadge}" style="font-size:11px;">${esc(zone.zone_type || '-')}</span>
                ${zone.is_reverse_lookup ? '<span class="badge badge-yellow" style="font-size:11px;">Reverse</span>' : ''}
                ${zone.is_ad_integrated ? '<span class="badge badge-green" style="font-size:11px;">AD-Integrated</span>' : ''}
              </div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text3);">
                <span>${recCount} records</span>
                <span style="font-size:14px;transition:transform .2s;" class="dns-chevron">&#9654;</span>
              </div>
            </div>
          </div>
          <div class="dns-detail" style="display:none;border-top:1px solid var(--border);padding:14px 16px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px;font-size:12px;">
              <div><span style="color:var(--text3);">Zone Type:</span> ${esc(zone.zone_type || '-')}</div>
              <div><span style="color:var(--text3);">Dynamic Update:</span> ${esc(zone.dynamic_update || '-')}</div>
              <div><span style="color:var(--text3);">Aging:</span> ${zone.aging_enabled ? 'Enabled' : 'Disabled'}</div>
            </div>`;

        if (zone.records && zone.records.length) {
          const byType = {};
          for (const r of zone.records) {
            const t = r.record_type || 'Other';
            if (!byType[t]) byType[t] = [];
            byType[t].push(r);
          }
          html += `<div style="max-height:300px;overflow-y:auto;"><table class="mini-table"><thead><tr><th>Type</th><th>Name</th><th>Data</th><th>TTL</th></tr></thead><tbody>`;
          for (const [type, records] of Object.entries(byType)) {
            for (let j = 0; j < records.length; j++) {
              const r = records[j];
              const typeBadgeClass = type === 'A' ? 'badge-green' : type === 'AAAA' ? 'badge-blue' : type === 'CNAME' ? 'badge-yellow' : type === 'MX' ? 'badge-red' : type === 'SRV' ? 'badge-blue' : 'badge-gray';
              html += `<tr>
                ${j === 0 ? `<td rowspan="${records.length}" style="vertical-align:top;"><span class="badge ${typeBadgeClass}">${esc(type)}</span></td>` : ''}
                <td>${esc(r.record_name || '@')}</td>
                <td style="font-family:monospace;font-size:12px;">${esc(r.record_data || '-')}</td>
                <td>${esc(r.ttl || '-')}</td>
              </tr>`;
            }
          }
          html += `</tbody></table></div>`;
        } else {
          html += `<p style="color:var(--text3);font-size:12px;margin:0;">No records loaded</p>`;
        }

        html += `</div></div>`;
      }

      html += `</div></div>`;
    }

    content.innerHTML = html;

    content.querySelectorAll('.dns-header').forEach(header => {
      header.addEventListener('click', () => {
        const detail = header.nextElementSibling;
        const chevron = header.querySelector('.dns-chevron');
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
      });
    });
  }

  // =========================================================================
  //  ADMIN PANEL
  // =========================================================================
  async function loadAdmin() {
    await Promise.all([loadUsers(), loadApiKeys(), loadGroups()]);
    setupAdminForms();
  }

  async function loadUsers() {
    try {
      const r = await fetch('/api/admin/users');
      const users = await r.json();
      const body = document.getElementById('usersBody');
      body.innerHTML = users.map(u => `<tr>
        <td>${esc(u.username)}</td>
        <td><span class="badge badge-blue">${esc(u.role)}</span></td>
        <td>${u.last_login ? fmtDate(u.last_login) : 'Never'}</td>
        <td>${currentUser && currentUser.id !== u.id ? `<button class="btn btn-danger btn-sm" data-del-user="${u.id}">Delete</button>` : ''}</td>
      </tr>`).join('');
      body.querySelectorAll('[data-del-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this user?')) return;
          await fetch('/api/admin/users/' + btn.dataset.delUser, { method: 'DELETE' });
          loadUsers();
        });
      });
    } catch (e) { console.error('Load users error:', e); }
  }

  async function loadApiKeys() {
    try {
      const r = await fetch('/api/admin/apikeys');
      const keys = await r.json();
      const body = document.getElementById('keysBody');
      body.innerHTML = keys.map(k => `<tr>
        <td>${esc(k.name)}</td>
        <td>${fmtDate(k.created_at)}</td>
        <td>${k.last_used ? fmtDate(k.last_used) : 'Never'}</td>
        <td><span class="badge ${k.active ? 'badge-green' : 'badge-red'}">${k.active ? 'Active' : 'Revoked'}</span></td>
        <td>${k.active ? `<button class="btn btn-danger btn-sm" data-del-key="${k.id}">Revoke</button>` : `<button class="btn btn-danger btn-sm" data-remove-key="${k.id}">Delete</button>`}</td>
      </tr>`).join('');
      body.querySelectorAll('[data-del-key]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Revoke this API key?')) return;
          await fetch('/api/admin/apikeys/' + btn.dataset.delKey, { method: 'DELETE' });
          loadApiKeys();
        });
      });
      body.querySelectorAll('[data-remove-key]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Permanently delete this revoked API key?')) return;
          await fetch('/api/admin/apikeys/' + btn.dataset.removeKey + '/purge', { method: 'DELETE' });
          loadApiKeys();
        });
      });
    } catch (e) { console.error('Load API keys error:', e); }
  }

  function setupAdminForms() {
    document.getElementById('addUserBtn').onclick = async () => {
      const username = document.getElementById('newUsername').value.trim();
      const password = document.getElementById('newPassword').value;
      const role = document.getElementById('newRole').value;
      if (!username || !password) return;
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      const d = await r.json();
      if (d.error) { alert(d.error); return; }
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      loadUsers();
    };

    document.getElementById('addKeyBtn').onclick = async () => {
      const name = document.getElementById('newKeyName').value.trim();
      if (!name) return;
      const r = await fetch('/api/admin/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const d = await r.json();
      if (d.key) {
        document.getElementById('newKeyValue').textContent = d.key;
        document.getElementById('newKeyDisplay').style.display = 'block';
      }
      document.getElementById('newKeyName').value = '';
      loadApiKeys();
    };

    document.getElementById('addGroupBtn').onclick = async () => {
      const name = document.getElementById('newGroupName').value.trim();
      if (!name) return;
      const desc = document.getElementById('newGroupDesc').value.trim();
      const r = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });
      const d = await r.json();
      if (d.error) { alert(d.error); return; }
      document.getElementById('newGroupName').value = '';
      document.getElementById('newGroupDesc').value = '';
      loadGroups();
    };
  }

  async function loadGroups() {
    try {
      const [groupsRes, usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/groups'),
        fetch('/api/admin/users'),
        fetch('/api/dashboard/stats')
      ]);
      const groups = await groupsRes.json();
      const users = await usersRes.json();
      const stats = await statsRes.json();
      const allDomains = stats.domains || [];

      const container = document.getElementById('groupsList');
      if (!groups.length) {
        container.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No groups created yet. Create a group to assign domain-level permissions to users.</p>';
        return;
      }

      container.innerHTML = groups.map(g => {
        const domainOptions = allDomains.map(d =>
          `<option value="${esc(d)}" ${g.domains.includes(d) ? 'selected' : ''}>${esc(d)}</option>`
        ).join('');
        const memberRows = g.members.map(m =>
          `<span class="badge badge-blue" style="margin:2px;display:inline-flex;align-items:center;gap:4px;">
            ${esc(m.username)}
            <button class="btn-icon" data-remove-member="${g.id}" data-uid="${m.user_id}" title="Remove">&times;</button>
          </span>`
        ).join('') || '<span style="color:var(--text-dim);font-size:12px;">No members</span>';
        const nonMembers = users.filter(u => !g.members.find(m => m.user_id === u.id));
        const addMemberOptions = nonMembers.map(u => `<option value="${u.id}">${esc(u.username)}</option>`).join('');

        return `<div class="group-card" style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;background:var(--bg2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <strong>${esc(g.name)}</strong>
              ${g.description ? `<span style="color:var(--text-dim);font-size:12px;margin-left:8px;">${esc(g.description)}</span>` : ''}
            </div>
            <button class="btn btn-danger btn-sm" data-del-group="${g.id}">Delete</button>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px;">Domains (hold Ctrl to multi-select)</label>
              <select multiple data-group-domains="${g.id}" style="width:100%;min-height:80px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;font-size:12px;">
                ${domainOptions}
              </select>
              <button class="btn btn-primary btn-sm" data-save-domains="${g.id}" style="margin-top:4px;">Save Domains</button>
            </div>
            <div style="flex:1;min-width:200px;">
              <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px;">Members</label>
              <div style="margin-bottom:6px;">${memberRows}</div>
              ${addMemberOptions ? `<div style="display:flex;gap:4px;margin-top:4px;">
                <select data-add-member-select="${g.id}" style="flex:1;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;font-size:12px;">
                  <option value="">Add user...</option>
                  ${addMemberOptions}
                </select>
                <button class="btn btn-primary btn-sm" data-add-member="${g.id}">Add</button>
              </div>` : ''}
            </div>
          </div>
        </div>`;
      }).join('');

      // Wire up event handlers
      container.querySelectorAll('[data-del-group]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this group? Members will lose their domain permissions.')) return;
          await fetch('/api/admin/groups/' + btn.dataset.delGroup, { method: 'DELETE' });
          loadGroups();
        });
      });

      container.querySelectorAll('[data-save-domains]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const gid = btn.dataset.saveDomains;
          const sel = container.querySelector(`[data-group-domains="${gid}"]`);
          const domains = Array.from(sel.selectedOptions).map(o => o.value);
          await fetch('/api/admin/groups/' + gid + '/domains', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains })
          });
          loadGroups();
        });
      });

      container.querySelectorAll('[data-add-member]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const gid = btn.dataset.addMember;
          const sel = container.querySelector(`[data-add-member-select="${gid}"]`);
          const userId = sel.value;
          if (!userId) return;
          await fetch('/api/admin/groups/' + gid + '/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: parseInt(userId, 10) })
          });
          loadGroups();
        });
      });

      container.querySelectorAll('[data-remove-member]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const gid = btn.dataset.removeMember;
          const uid = btn.dataset.uid;
          await fetch(`/api/admin/groups/${gid}/members/${uid}`, { method: 'DELETE' });
          loadGroups();
        });
      });
    } catch (e) { console.error('Load groups error:', e); }
  }

  // =========================================================================
  //  UTILITIES
  // =========================================================================
  function fmtDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '-';
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return d.toLocaleDateString();
  }

  // =========================================================================
  //  SECURITY POSTURE TAB
  // =========================================================================
  let secLoaded = false;
  let secPostureData = [];

  async function loadSecurityView() {
    if (!secLoaded) {
      setupSecurityEvents();
      secLoaded = true;
    }
    await refreshSecurityView();
  }

  function setupSecurityEvents() {
    const searchInput = document.getElementById('secSearch');
    let searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderSecurityList(), 300);
      });
    }
    const domFilter = document.getElementById('secDomainFilter');
    if (domFilter) domFilter.addEventListener('change', () => renderSecurityList());
    const statusFilter = document.getElementById('secStatusFilter');
    if (statusFilter) statusFilter.addEventListener('change', () => renderSecurityList());
  }

  async function refreshSecurityView() {
    const content = document.getElementById('secContent');
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

    try {
      const [postureRes, summaryRes] = await Promise.all([
        fetch('/api/security/posture'),
        fetch('/api/security/summary')
      ]);
      secPostureData = await postureRes.json();
      const summary = await summaryRes.json();

      // Populate domain filter
      const domFilter = document.getElementById('secDomainFilter');
      if (domFilter && domFilter.options.length <= 1) {
        const domains = [...new Set(secPostureData.map(s => s.domain).filter(Boolean))].sort();
        for (const d of domains) {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          domFilter.appendChild(opt);
        }
      }

      renderSecuritySummary(summary);
      renderSecurityList();
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><p>Error loading security data.</p></div>';
    }
  }

  function renderSecuritySummary(s) {
    const bar = document.getElementById('secSummaryBar');
    if (!bar) return;
    const card = (label, value, color) => `<div style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;min-width:120px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
      <div style="font-size:12px;opacity:0.7;">${label}</div>
    </div>`;
    bar.innerHTML = [
      card('Total Servers', s.total || 0, 'var(--accent)'),
      card('Missing Patches', s.servers_missing_patches || 0, (s.servers_missing_patches > 0 ? '#e74c3c' : '#27ae60')),
      card('Total Missing', s.total_missing_patches || 0, (s.total_missing_patches > 0 ? '#e67e22' : '#27ae60')),
      card('Reboot Pending', s.reboot_pending || 0, (s.reboot_pending > 0 ? '#e67e22' : '#27ae60')),
      card('AV Issues', s.av_issues || 0, (s.av_issues > 0 ? '#e74c3c' : '#27ae60')),
      card('RDP no NLA', s.rdp_no_nla || 0, (s.rdp_no_nla > 0 ? '#e67e22' : '#27ae60')),
      card('Critical Events', s.critical_events || 0, (s.critical_events > 0 ? '#e74c3c' : '#27ae60')),
      card('CVEs Tracked', s.cve_total || 0, 'var(--accent)'),
      card('High/Crit CVEs', (s.cve_high || 0), (s.cve_high > 0 ? '#e67e22' : '#27ae60')),
    ].join('');
  }

  function renderSecurityList() {
    const content = document.getElementById('secContent');
    const searchQ = (document.getElementById('secSearch')?.value || '').toLowerCase();
    const domainF = document.getElementById('secDomainFilter')?.value || '';
    const statusF = document.getElementById('secStatusFilter')?.value || '';

    let filtered = secPostureData;
    if (searchQ) filtered = filtered.filter(s => s.hostname.toLowerCase().includes(searchQ) || (s.os_edition || '').toLowerCase().includes(searchQ));
    if (domainF) filtered = filtered.filter(s => s.domain === domainF);
    if (statusF === 'missing') filtered = filtered.filter(s => s.missing_critical_updates > 0);
    else if (statusF === 'reboot') filtered = filtered.filter(s => s.reboot_pending);
    else if (statusF === 'av') filtered = filtered.filter(s => s.antivirus_status && s.antivirus_status !== 'OK');
    else if (statusF === 'rdp') filtered = filtered.filter(s => s.rdp_enabled && !s.nla_enabled);

    if (filtered.length === 0) {
      content.innerHTML = '<div class="empty-state"><p>No servers match the current filter.</p></div>';
      return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="border-bottom:2px solid var(--border);text-align:left;">' +
      '<th style="padding:10px 12px;">Server</th>' +
      '<th style="padding:10px 8px;">OS</th>' +
      '<th style="padding:10px 8px;">Last Patched</th>' +
      '<th style="padding:10px 8px;">Missing</th>' +
      '<th style="padding:10px 8px;">Reboot</th>' +
      '<th style="padding:10px 8px;">AV</th>' +
      '<th style="padding:10px 8px;">RDP</th>' +
      '<th style="padding:10px 8px;">Events</th>' +
      '<th style="padding:10px 8px;">Products</th>' +
      '</tr></thead><tbody>';

    for (const s of filtered) {
      const patchAge = patchAgeDays(s.last_patch_date);
      const patchColor = patchAge > 60 ? '#e74c3c' : patchAge > 30 ? '#e67e22' : '#27ae60';
      const patchText = s.last_patch_date ? timeAgo(s.last_patch_date) : '<span style="color:#e74c3c">Never</span>';

      const missingBadge = s.missing_critical_updates > 0
        ? `<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;">${s.missing_critical_updates}</span>`
        : '<span style="color:#27ae60;font-size:12px;">0</span>';

      const rebootBadge = s.reboot_pending
        ? '<span style="background:#e67e22;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">Yes</span>'
        : '<span style="color:#27ae60;font-size:12px;">No</span>';

      const avBadge = s.antivirus_status === 'OK'
        ? '<span style="color:#27ae60;font-size:12px;">OK</span>'
        : `<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${esc(s.antivirus_status || 'Unknown')}</span>`;

      let rdpBadge = '';
      if (s.rdp_enabled) {
        rdpBadge = s.nla_enabled
          ? '<span style="color:#e67e22;font-size:12px;">On+NLA</span>'
          : '<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">On (no NLA)</span>';
      } else {
        rdpBadge = '<span style="color:#27ae60;font-size:12px;">Off</span>';
      }

      const eventsBadge = s.critical_events_24h > 0
        ? `<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${s.critical_events_24h}</span>`
        : '<span style="color:#27ae60;font-size:12px;">0</span>';

      const prodTags = s.products.slice(0, 4).map(p =>
        `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;background:rgba(160,100,255,0.12);color:#b07aff;margin:1px;">${esc(p)}</span>`
      ).join('');

      html += `<tr style="border-bottom:1px solid var(--border);cursor:pointer;" data-server-id="${s.id}" data-products="${esc(s.products.join(','))}">
        <td style="padding:8px 12px;"><strong>${esc(s.hostname)}</strong><br><span style="font-size:11px;opacity:0.6;">${esc(s.domain || '')}</span></td>
        <td style="padding:8px;">${esc(s.os_edition || '')}<br><span style="font-size:11px;opacity:0.6;">${esc(s.os_build || '')}</span></td>
        <td style="padding:8px;color:${patchColor}">${patchText}</td>
        <td style="padding:8px;">${missingBadge}</td>
        <td style="padding:8px;">${rebootBadge}</td>
        <td style="padding:8px;">${avBadge}</td>
        <td style="padding:8px;">${rdpBadge}</td>
        <td style="padding:8px;">${eventsBadge}</td>
        <td style="padding:8px;">${prodTags}</td>
      </tr>`;

      // Missing updates sub-row (expanded inline)
      if (s.missing_updates && s.missing_updates.length > 0) {
        html += `<tr style="border-bottom:1px solid var(--border);background:var(--bg);"><td colspan="9" style="padding:4px 12px 8px 24px;">`;
        html += '<div style="font-size:12px;opacity:0.7;margin-bottom:4px;">Missing Updates:</div>';
        for (const u of s.missing_updates) {
          const sevColor = u.severity === 'Critical' ? '#e74c3c' : u.severity === 'Important' ? '#e67e22' : '#888';
          html += `<div style="font-size:12px;padding:2px 0;"><span style="color:${sevColor};font-weight:600;">${esc(u.severity || '')}</span> <span style="opacity:0.6;">${esc(u.kb_id || '')}</span> ${esc(u.title || '')}</div>`;
        }
        html += '</td></tr>';
      }
    }

    html += '</tbody></table>';
    content.innerHTML = html;

    // Click handler for rows to show matching CVEs
    content.querySelectorAll('tr[data-server-id]').forEach(row => {
      row.addEventListener('click', async () => {
        const products = (row.dataset.products || '').split(',').filter(Boolean);
        const hostname = row.querySelector('strong')?.textContent || '';
        if (products.length === 0) return;
        await showServerCves(hostname, products);
      });
    });
  }

  async function showServerCves(hostname, products) {
    const content = document.getElementById('secContent');
    // Find existing CVE panel or create one
    let panel = document.getElementById('secCvePanel');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'secCvePanel';
    panel.style.cssText = 'border-top:2px solid var(--accent);padding:16px;background:var(--bg);';
    panel.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div> Loading matching CVEs...</div>';
    content.parentElement.insertBefore(panel, content.nextSibling);

    try {
      const r = await fetch('/api/security/server-cves?products=' + encodeURIComponent(products.join(',')) + '&limit=30');
      const cves = await r.json();

      if (cves.length === 0) {
        panel.innerHTML = `<div style="padding:12px;"><strong>${esc(hostname)}</strong> — <span style="opacity:0.7;">No matching CVEs found in the database for detected products.</span>
          <button class="action-btn" style="float:right;" onclick="this.closest('#secCvePanel').remove()">Close</button></div>`;
        return;
      }

      let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div><strong>${esc(hostname)}</strong> — <span style="opacity:0.7;">${cves.length} potentially relevant CVEs (${products.join(', ')})</span></div>
        <button class="action-btn" onclick="this.closest('#secCvePanel').remove()">Close</button>
      </div>`;

      for (const cve of cves) {
        const cvss = cve.cvss != null ? parseFloat(cve.cvss) : null;
        const cvssHtml = cvss != null
          ? `<span style="color:${cvssColor(cvss)};font-weight:700;">CVSS ${cvss.toFixed(1)}</span>`
          : '';
        let badges = '';
        if (cve._vendor) badges += `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:rgba(160,100,255,0.15);color:#b07aff;margin-right:3px;">${esc(cve._vendor)}</span>`;
        if (cve._exploit) badges += '<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:rgba(231,76,60,0.15);color:#e74c3c;margin-right:3px;">Exploit</span>';
        if (!cve._patch) badges += '<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:rgba(231,76,60,0.1);color:#e67e22;margin-right:3px;">No patch</span>';

        html += `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <a href="https://cve.circl.lu/cve/${encodeURIComponent(cve.id)}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;">${esc(cve.id)}</a>
          ${cvssHtml} ${badges}
          <span style="opacity:0.7;">${esc(cve.title || cve.summary?.slice(0, 100) || '')}</span>
        </div>`;
      }

      panel.innerHTML = html;
    } catch (e) {
      panel.innerHTML = `<div style="padding:12px;">Error loading CVEs. <button class="action-btn" onclick="this.closest('#secCvePanel').remove()">Close</button></div>`;
    }
  }

  function patchAgeDays(dateStr) {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 999;
    return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  }

  // =========================================================================
  //  CVEs TAB (general CVE intelligence)
  // =========================================================================
  let cveOffset = 0;
  let cveRiskMode = false;
  let cveLoaded = false;
  let cveVendorChart = null;

  async function loadCvesView() {
    if (!cveLoaded) {
      cveOffset = 0;
      cveRiskMode = false;
      setupCveEvents();
      cveLoaded = true;
    }
    await refreshCveView();
  }

  function setupCveEvents() {
    const searchInput = document.getElementById('cveSearch');
    let searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { cveOffset = 0; refreshCveView(); }, 400);
      });
    }
    const sevFilter = document.getElementById('cveSeverityFilter');
    if (sevFilter) sevFilter.addEventListener('change', () => { cveOffset = 0; refreshCveView(); });

    const toggleBtn = document.getElementById('cveViewToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        cveRiskMode = !cveRiskMode;
        toggleBtn.textContent = cveRiskMode ? '📋 Latest' : '⚠ Risk';
        cveOffset = 0;
        refreshCveView();
      });
    }

    const loadMore = document.getElementById('cveLoadMore');
    if (loadMore) {
      loadMore.addEventListener('click', () => {
        cveOffset += 50;
        refreshCveView(true);
      });
    }
  }

  function updateRiskPanels() {
    const formula = document.getElementById('cveRiskFormula');
    const chartWrap = document.getElementById('cveRiskChartWrap');
    const simpleBar = document.getElementById('cveVendorBarSimple');
    if (formula) formula.style.display = cveRiskMode ? '' : 'none';
    if (chartWrap) chartWrap.style.display = cveRiskMode ? '' : 'none';
    if (simpleBar) simpleBar.style.display = cveRiskMode ? 'none' : '';
  }

  async function refreshCveView(append) {
    const content = document.getElementById('cveContent');
    const loadMore = document.getElementById('cveLoadMore');
    const searchQ = (document.getElementById('cveSearch')?.value || '').trim();
    const cvssMin = document.getElementById('cveSeverityFilter')?.value || '';

    updateRiskPanels();

    if (!append) {
      content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
    }

    try {
      let cves;
      if (searchQ) {
        const r = await fetch('/api/cves/search?q=' + encodeURIComponent(searchQ) + '&limit=100');
        cves = await r.json();
        loadMore.style.display = 'none';
      } else if (cveRiskMode) {
        const r = await fetch('/api/cves/risk?count=50&offset=' + cveOffset + '&maxAge=90');
        cves = await r.json();
        loadMore.style.display = cves.length >= 50 ? '' : 'none';
      } else {
        const url = '/api/cves?count=50&offset=' + cveOffset + (cvssMin ? '&cvssMin=' + cvssMin : '');
        const r = await fetch(url);
        cves = await r.json();
        loadMore.style.display = cves.length >= 50 ? '' : 'none';
      }

      if (!append) content.innerHTML = '';
      if (cves.length === 0 && !append) {
        content.innerHTML = '<div class="empty-state"><p>No CVEs found.</p></div>';
      } else {
        const frag = document.createDocumentFragment();
        for (const cve of cves) {
          frag.appendChild(buildCveCard(cve));
        }
        content.appendChild(frag);
      }

      // Update summary & vendor bars (only on first load / non-append)
      if (!append) {
        loadCveSummary();
        loadCveVendors();
      }
    } catch (e) {
      if (!append) content.innerHTML = '<div class="empty-state"><p>Error loading CVE data.</p></div>';
    }
  }

  function cvssColor(score) {
    if (score == null || isNaN(score)) return '';
    if (score >= 9) return '#e74c3c';
    if (score >= 7) return '#e67e22';
    if (score >= 4) return '#f1c40f';
    return '#27ae60';
  }

  function riskScoreColor(score) {
    if (score >= 200) return '#ff2244';
    if (score >= 150) return '#ff6622';
    if (score >= 100) return '#ffaa00';
    return '#44bb44';
  }

  function buildCveCard(cve) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:12px 16px;border-bottom:1px solid var(--border);';

    const cvss = cve.cvss != null ? parseFloat(cve.cvss) : null;
    const cvssHtml = cvss != null
      ? `<span style="color:${cvssColor(cvss)};font-weight:700">CVSS ${cvss.toFixed(1)}</span>`
      : '<span style="opacity:0.5">No CVSS</span>';

    const pubDate = cve.published ? timeAgo(cve.published) : '';

    let badges = '';
    if (cve._vendor) badges += `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(160,100,255,0.15);color:#b07aff;font-weight:600;margin-right:4px;">${esc(cve._vendor)}</span>`;
    if (cve._kev) badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(231,76,60,0.2);color:#e74c3c;font-weight:700;margin-right:4px;">KEV</span>';
    if (cve._exploit) badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(231,76,60,0.15);color:#e74c3c;font-weight:600;margin-right:4px;">Exploit</span>';
    if (cve._patch) badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(39,174,96,0.15);color:#27ae60;font-weight:600;margin-right:4px;">Patch</span>';
    else badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(231,76,60,0.1);color:#e67e22;font-weight:600;margin-right:4px;">No patch</span>';
    if (cve._epss != null) badges += `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:rgba(0,180,255,0.18);color:#44bbff;font-weight:600;margin-right:4px;">EPSS ${(cve._epss * 100).toFixed(1)}%</span>`;
    if (cve._riskScore != null) badges += `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:${riskScoreColor(cve._riskScore)};color:#fff;font-weight:700;margin-right:4px;">Risk ${cve._riskScore}</span>`;

    const title = esc(cve.title || cve.summary?.slice(0, 120) || '');
    const summary = cve.summary ? esc(cve.summary.length > 300 ? cve.summary.slice(0, 300) + '…' : cve.summary) : '';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <strong><a href="https://cve.circl.lu/cve/${encodeURIComponent(cve.id)}" target="_blank" rel="noopener" style="color:var(--accent);">${esc(cve.id)}</a></strong>
        <span style="font-size:13px;opacity:0.7">${pubDate}</span>
      </div>
      ${title ? `<div style="margin-bottom:4px;font-weight:500;">${title}</div>` : ''}
      <div style="margin-bottom:6px;">${cvssHtml}</div>
      <div style="margin-bottom:6px;">${badges}</div>
      ${summary ? `<div style="font-size:13px;opacity:0.8;line-height:1.4;">${summary}</div>` : ''}
    `;
    return card;
  }

  async function loadCveSummary() {
    const bar = document.getElementById('cveSummaryBar');
    if (!bar) return;
    try {
      const r = await fetch('/api/cves/count');
      const data = await r.json();
      bar.innerHTML = `
        <div style="font-weight:600;">Total CVEs: <span style="color:var(--accent);">${data.count || 0}</span></div>
      `;
    } catch (e) {
      bar.innerHTML = '';
    }
  }

  async function loadCveVendors() {
    const simpleBar = document.getElementById('cveVendorBarSimple');
    const riskBar = document.getElementById('cveVendorBar');
    try {
      const r = await fetch('/api/cves/vendors?maxAge=60');
      const vendors = await r.json();

      // Simple vendor chips (non-risk mode)
      if (simpleBar) {
        if (!vendors.length) { simpleBar.innerHTML = ''; }
        else {
          simpleBar.innerHTML = vendors.slice(0, 10).map(v => {
            const crit = v.critical_count > 0 ? `<span style="color:#e74c3c;font-weight:700">${v.critical_count}C</span>` : '';
            const high = (v.high_count - (v.critical_count || 0)) > 0 ? `<span style="color:#e67e22;font-weight:600">${v.high_count - (v.critical_count || 0)}H</span>` : '';
            return `<span style="display:inline-block;padding:4px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;">
              <strong>${esc(v.vendor)}</strong> ${v.total} ${crit} ${high}
            </span>`;
          }).join('');
        }
      }

      // Risk vendor bar + chart (risk mode)
      if (riskBar) {
        if (!vendors.length) { riskBar.innerHTML = ''; }
        else {
          riskBar.innerHTML = vendors.map(v => {
            const crit = v.critical_count > 0 ? `<span style="color:#ff2244;font-weight:700">${v.critical_count} crit</span>` : '';
            const high = v.high_count > 0 ? `<span style="color:#ff6622;font-weight:600">${v.high_count} high</span>` : '';
            const kev = v.kev_count > 0 ? `<span style="color:#e74c3c;font-weight:600">${v.kev_count} KEV</span>` : '';
            return `<span style="display:inline-block;padding:6px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;line-height:1.5;">
              <strong>${esc(v.vendor)}</strong><br>${v.total} total · avg ${Math.round(v.avg_risk || 0)}<br>${crit} ${high} ${kev}
            </span>`;
          }).join('');
        }
      }

      // Vendor risk chart
      renderCveVendorChart(vendors);
    } catch (e) {
      if (simpleBar) simpleBar.innerHTML = '';
      if (riskBar) riskBar.innerHTML = '';
    }
  }

  function renderCveVendorChart(vendors) {
    const canvas = document.getElementById('cveVendorChart');
    if (!canvas || !vendors || !vendors.length) return;
    if (typeof Chart === 'undefined') return;

    const labels = vendors.map(v => v.vendor || 'Unknown');
    const criticals = vendors.map(v => v.critical_count || 0);
    const highs = vendors.map(v => Math.max(0, (v.high_count || 0) - (v.critical_count || 0)));

    if (cveVendorChart) cveVendorChart.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const tickColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(40,20,60,0.6)';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(100,60,140,0.08)';

    cveVendorChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Critical (200+)',
          data: criticals,
          backgroundColor: '#ff2244',
          borderRadius: 4,
          barPercentage: 0.7
        }, {
          label: 'High (150+)',
          data: highs,
          backgroundColor: '#ff6622',
          borderRadius: 4,
          barPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } }
        },
        scales: {
          x: { stacked: true, ticks: { color: tickColor, stepSize: 1 }, grid: { color: gridColor } },
          y: { stacked: true, ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  }

})();
