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
    setupLogout();
    setupModalClose();
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
        if (btn.dataset.tab === 'gpo') loadGPOView();
        if (btn.dataset.tab === 'logbook') loadGlobalLogbook();
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
    grid.innerHTML = `
      <div class="stat-card accent">
        <div class="stat-label">Total Servers</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-sub">${stats.virtual} virtual, ${stats.physical} physical</div>
      </div>
      ${hasHeartbeat ? `<div class="stat-card ${stats.offline > 0 ? 'danger' : 'success'}">
        <div class="stat-label">Server Status</div>
        <div class="stat-value">${stats.online} <span style="font-size:14px;color:var(--text3)">/ ${stats.total - stats.neverReported}</span></div>
        <div class="stat-sub">${stats.online} online, ${stats.offline} offline${stats.neverReported > 0 ? ', ' + stats.neverReported + ' no heartbeat' : ''}</div>
      </div>` : ''}
      <div class="stat-card ${stats.rebootPending > 0 ? 'warning' : 'success'}">
        <div class="stat-label">Reboot Pending</div>
        <div class="stat-value">${stats.rebootPending}</div>
        <div class="stat-sub">servers need restart</div>
      </div>
      <div class="stat-card ${stats.missingUpdates > 0 ? 'danger' : 'success'}">
        <div class="stat-label">Missing Updates</div>
        <div class="stat-value">${stats.missingUpdates}</div>
        <div class="stat-sub">servers with critical patches missing</div>
      </div>
      <div class="stat-card ${stats.criticalEvents > 0 ? 'danger' : 'success'}">
        <div class="stat-label">Critical Events</div>
        <div class="stat-value">${stats.criticalEvents}</div>
        <div class="stat-sub">servers with critical errors (24h)</div>
      </div>
      <div class="stat-card ${stats.diskCritical > 0 ? 'danger' : stats.diskWarning > 0 ? 'warning' : 'success'}">
        <div class="stat-label">Disk Space</div>
        <div class="stat-value">${stats.diskCritical > 0 ? stats.diskCritical : stats.diskWarning}</div>
        <div class="stat-sub">${stats.diskCritical > 0 ? stats.diskCritical + ' critical' : ''} ${stats.diskWarning > 0 ? stats.diskWarning + ' warning' : ''} ${stats.diskCritical === 0 && stats.diskWarning === 0 ? 'all disks healthy' : ''}</div>
      </div>
      ${stats.serviceIssues > 0 ? `<div class="stat-card warning">
        <div class="stat-label">Service Issues</div>
        <div class="stat-value">${stats.serviceIssues}</div>
        <div class="stat-sub">servers with stopped auto-start services</div>
      </div>` : ''}
      <div class="stat-card ${stats.inMaintenance > 0 ? 'warning' : 'success'}">
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
        <h3>Hypervisor Distribution</h3>
        <div class="chart-canvas-wrap"><canvas id="chartHypervisor"></canvas></div>
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

    // Hypervisor
    const hvLabels = (stats.hypervisorDistribution || []).map(h => h.hypervisor || 'Unknown');
    const hvData = (stats.hypervisorDistribution || []).map(h => h.count);
    charts.hypervisor = new Chart(document.getElementById('chartHypervisor'), {
      type: 'doughnut',
      data: {
        labels: hvLabels,
        datasets: [{ data: hvData, backgroundColor: colors.palette.slice(0, hvLabels.length), borderWidth: 0 }]
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
        <td><strong>${esc(s.hostname)}</strong>${s.maintenance_mode && s.maintenance_until && new Date(s.maintenance_until) > new Date() ? ' <span class="badge-maintenance">\ud83d\udd27 Maintenance</span>' : ''}</td>
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

    // Maintenance banner or set-maintenance form
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
      html += `<div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm" id="maintStartBtn" style="background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600;">\ud83d\udd27 Set Maintenance</button>
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
    html += `<div class="logbook-form" style="margin-bottom:16px;display:flex;gap:8px;">
      <input type="text" class="search-input" id="logbookInput" placeholder="Add a logbook entry..." style="flex:1;">
      <button class="btn btn-primary" id="logbookAddBtn" style="white-space:nowrap;">Add Entry</button>
    </div>`;
    html += `<div id="logbookEntries"><div style="text-align:center;padding:16px;color:var(--text3);"><div class="spinner"></div></div></div>`;
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
    loadLogbook(s.hostname, container);
    const lbInput = container.querySelector('#logbookInput');
    const lbBtn = container.querySelector('#logbookAddBtn');
    if (lbBtn) {
      const submitEntry = async () => {
        const comment = lbInput.value.trim();
        if (!comment) return;
        lbBtn.disabled = true;
        try {
          await fetch('/api/servers/' + encodeURIComponent(s.hostname) + '/logbook', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
          });
          lbInput.value = '';
          loadLogbook(s.hostname, container);
        } catch (e) { console.error(e); }
        lbBtn.disabled = false;
      };
      lbBtn.addEventListener('click', submitEntry);
      lbInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEntry(); });
    }

    // Maintenance mode buttons
    const maintStartBtn = container.querySelector('#maintStartBtn');
    const maintFormWrap = container.querySelector('#maintFormWrap');
    const maintEndBtn = container.querySelector('#maintEndBtn');

    if (maintStartBtn) {
      maintStartBtn.addEventListener('click', () => {
        maintStartBtn.style.display = 'none';
        maintFormWrap.style.display = 'flex';
      });
      container.querySelector('#maintCancelBtn').addEventListener('click', () => {
        maintFormWrap.style.display = 'none';
        maintStartBtn.style.display = '';
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

  async function loadLogbook(hostname, container) {
    const el = container.querySelector('#logbookEntries');
    try {
      const r = await fetch('/api/servers/' + encodeURIComponent(hostname) + '/logbook');
      const entries = await r.json();
      if (!entries.length) {
        el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:16px;">No logbook entries yet</p>';
        return;
      }
      el.innerHTML = entries.map(e => `
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
          loadLogbook(hostname, container);
        });
      });
    } catch (e) {
      el.innerHTML = '<p style="color:var(--text3)">Error loading logbook</p>';
    }
  }

  function setupModalClose() {
    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('serverModal').classList.remove('open');
    });
    document.getElementById('serverModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
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
  //  GROUP POLICY VIEW
  // =========================================================================
  let gpoData = [];
  let gpoLoaded = false;

  async function loadGPOView() {
    if (gpoLoaded) return;

    const content = document.getElementById('gpoContent');
    content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

    try {
      // Load domains for filter
      const domainsR = await fetch('/api/gpo/domains');
      const domains = await domainsR.json();
      const domainSel = document.getElementById('gpoDomainFilter');
      domainSel.innerHTML = '<option value="">All Domains</option>' +
        domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

      // Load all GPOs
      const r = await fetch('/api/gpo');
      gpoData = await r.json();
      renderGPOView(gpoData);

      // Wire filters
      domainSel.addEventListener('change', filterGPOView);
      document.getElementById('gpoSearch').addEventListener('input', filterGPOView);

      gpoLoaded = true;
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><p>Error loading group policies. Run Collect-DomainGPO.ps1 on a domain controller to collect GPO data.</p></div>';
    }
  }

  function filterGPOView() {
    const domain = document.getElementById('gpoDomainFilter').value;
    const q = document.getElementById('gpoSearch').value.toLowerCase().trim();
    let filtered = gpoData;
    if (domain) filtered = filtered.filter(g => g.domain === domain);
    if (q) filtered = filtered.filter(g =>
      (g.gpo_name || '').toLowerCase().includes(q) ||
      (g.gpo_guid || '').toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q) ||
      (g.settings || []).some(s => (s.setting_name || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))
    );
    renderGPOView(filtered);
  }

  function renderGPOView(gpos) {
    const content = document.getElementById('gpoContent');
    if (!gpos.length) {
      content.innerHTML = '<div class="empty-state"><p>No group policies found. Run <strong>Collect-DomainGPO.ps1</strong> on a domain controller to populate data.</p></div>';
      return;
    }

    let html = '';
    for (const gpo of gpos) {
      const statusBadge = (gpo.gpo_status || '').toLowerCase().includes('all') ? 'badge-green'
        : (gpo.gpo_status || '').toLowerCase().includes('disabled') ? 'badge-red' : 'badge-yellow';

      html += `<div class="panel" style="margin-bottom:12px;">
        <div style="padding:16px;cursor:pointer;" class="gpo-header" data-gpo-id="${gpo.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:12px;">
              <strong style="font-size:14px;">${esc(gpo.gpo_name || '-')}</strong>
              <span class="badge ${statusBadge}">${esc(gpo.gpo_status || '-')}</span>
              <span class="badge badge-blue">${esc(gpo.domain || '-')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px;font-size:12px;color:var(--text3);">
              ${gpo.modification_time ? '<span>Modified: ' + fmtDate(gpo.modification_time) + '</span>' : ''}
              <span style="font-size:16px;transition:transform .2s;" class="gpo-chevron">&#9654;</span>
            </div>
          </div>
          ${gpo.description ? `<div style="font-size:12px;color:var(--text3);margin-top:6px;">${esc(gpo.description)}</div>` : ''}
        </div>
        <div class="gpo-detail" style="display:none;border-top:1px solid var(--border);padding:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px;">
            <div><span style="color:var(--text3);">GUID:</span> <span style="font-family:monospace;">${esc(gpo.gpo_guid || '-')}</span></div>
            <div><span style="color:var(--text3);">Created:</span> ${fmtDate(gpo.creation_time)}</div>
            <div><span style="color:var(--text3);">WMI Filter:</span> ${esc(gpo.wmi_filter || 'None')}</div>
            <div><span style="color:var(--text3);">Modified:</span> ${fmtDate(gpo.modification_time)}</div>
          </div>`;

      // Links section
      if (gpo.links && gpo.links.length) {
        html += `<h4 style="font-size:12px;text-transform:uppercase;color:var(--text3);letter-spacing:.5px;margin-bottom:8px;">Links</h4>
          <table class="mini-table" style="margin-bottom:16px;"><thead><tr><th>Target</th><th>Enabled</th><th>Enforced</th></tr></thead><tbody>`;
        for (const link of gpo.links) {
          html += `<tr>
            <td>${esc(link.target || '-')}</td>
            <td><span class="badge ${link.link_enabled ? 'badge-green' : 'badge-red'}">${link.link_enabled ? 'Yes' : 'No'}</span></td>
            <td><span class="badge ${link.enforced ? 'badge-yellow' : 'badge-gray'}">${link.enforced ? 'Yes' : 'No'}</span></td>
          </tr>`;
        }
        html += `</tbody></table>`;
      }

      // Settings section
      if (gpo.settings && gpo.settings.length) {
        // Group settings by area > category
        const grouped = {};
        for (const s of gpo.settings) {
          const key = (s.area || 'Other') + ' / ' + (s.category || 'General');
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        }

        html += `<h4 style="font-size:12px;text-transform:uppercase;color:var(--text3);letter-spacing:.5px;margin-bottom:8px;">Settings (${gpo.settings.length})</h4>
          <div style="max-height:400px;overflow-y:auto;"><table class="mini-table"><thead><tr><th>Area / Category</th><th>Setting</th><th>Value</th></tr></thead><tbody>`;
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
        html += `<p style="color:var(--text3);font-size:12px;">No settings configured</p>`;
      }

      html += `</div></div>`;
    }

    content.innerHTML = html;

    // Wire expand/collapse
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

})();
