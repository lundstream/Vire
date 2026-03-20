// Seed script — generates 1000 servers across 10 domains for stress testing
// Usage: node scripts/seed-stress-test.js
// WARNING: This will insert 1000 servers. Existing sample servers remain untouched.

const path = require('path');
process.chdir(path.join(__dirname, '..'));
const db = require('../db');

const DOMAINS = [
  'CONTOSO', 'FABRIKAM', 'NORTHWIND', 'ADVENTUREWORKS', 'TAILSPIN',
  'WOODGROVE', 'LITWARE', 'PROSEWARE', 'FOURTHCOFFEE', 'WINGTIP'
];

const OS_EDITIONS = [
  'Windows Server 2022 Datacenter',
  'Windows Server 2022 Standard',
  'Windows Server 2019 Datacenter',
  'Windows Server 2019 Standard',
  'Windows Server 2016 Standard',
  'Windows Server 2025 Datacenter',
];

const HYPERVISORS = ['Hyper-V', 'VMware ESXi', 'Nutanix AHV', null];

const CPU_MODELS = [
  'Intel Xeon E-2388G', 'Intel Xeon Gold 6330', 'Intel Xeon Silver 4316',
  'AMD EPYC 7543', 'AMD EPYC 9354', 'Intel Xeon W-3375'
];

const AV_STATUSES = ['Active', 'Active', 'Active', 'Active', 'Active',
  'Enabled', 'Up to date', 'Out of date', 'Disabled', 'Unknown'];

const ROLE_TYPES = [
  { name: 'Web-Server', type: 'Role' },
  { name: 'AD-Domain-Services', type: 'Role' },
  { name: 'DNS', type: 'Role' },
  { name: 'DHCP', type: 'Role' },
  { name: 'File-Services', type: 'Role' },
  { name: 'Print-Services', type: 'Role' },
  { name: 'Hyper-V', type: 'Role' },
  { name: 'WSUS', type: 'Role' },
  { name: 'Failover-Clustering', type: 'Feature' },
  { name: 'NET-Framework-45-Features', type: 'Feature' },
  { name: 'RSAT-AD-Tools', type: 'Feature' },
  { name: 'Telnet-Client', type: 'Feature' },
];

const SERVER_PREFIXES = ['DC', 'WEB', 'SQL', 'APP', 'FILE', 'MAIL', 'PRINT', 'BACKUP', 'RDS', 'SCCM', 'WSUS', 'DHCP', 'DNS', 'HV', 'MGMT', 'MON', 'LOG', 'PKI', 'NPS', 'ADFS'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function chance(pct) { return Math.random() * 100 < pct; }
function randIp(subnet) { return `${subnet}.${rand(1, 254)}`; }
function randMac() { return Array.from({length: 6}, () => rand(0, 255).toString(16).padStart(2, '0')).join(':').toUpperCase(); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function hoursAgo(n) { return new Date(Date.now() - n * 3600000).toISOString(); }

const subnets = {};
DOMAINS.forEach((d, i) => { subnets[d] = `10.${i + 1}.${rand(0, 3)}`; });

console.log('Generating 1000 servers across 10 domains...');
const t0 = Date.now();
const d = db.getDb();

// Use a transaction for speed
const insertAll = d.transaction(() => {
  let count = 0;
  for (const domain of DOMAINS) {
    const domainLower = domain.toLowerCase();
    const serversPerDomain = domain === 'CONTOSO' ? 200 : rand(70, 120);
    const dc = `dc.${domainLower}.local`;
    const subnet = subnets[domain];

    for (let i = 1; i <= serversPerDomain && count < 1000; i++) {
      count++;
      const prefix = pick(SERVER_PREFIXES);
      const hostname = `${prefix}${String(i).padStart(3, '0')}-${domain.substring(0, 3)}`;
      const isVirtual = chance(75);
      const os = pick(OS_EDITIONS);
      const cpuCores = pick([2, 4, 8, 16]);
      const ramTotal = pick([4, 8, 16, 32, 64, 128]);
      const ramUsed = Math.round((ramTotal * (rand(30, 95) / 100)) * 10) / 10;
      const cpuUsage = rand(2, 98);
      const missingUpdates = chance(20) ? rand(1, 8) : 0;
      const rebootPending = chance(15);
      const critEvents = chance(12) ? rand(1, 15) : 0;
      const rdpEnabled = chance(60);
      const nlaEnabled = rdpEnabled ? chance(80) : null;
      const maintMode = chance(5);
      const staleDays = chance(8) ? rand(8, 30) : 0;

      const serverData = {
        hostname,
        fqdn: `${hostname.toLowerCase()}.${domainLower}.local`,
        domain_or_workgroup: domain,
        domain_type: 'Domain',
        ou: `OU=${prefix}s,OU=Servers,DC=${domainLower},DC=local`,
        os_edition: os,
        os_version: os.includes('2025') ? '10.0.26100' : os.includes('2022') ? '10.0.20348' : os.includes('2019') ? '10.0.17763' : '10.0.14393',
        os_build: os.includes('2025') ? '24H2' : os.includes('2022') ? '21H2' : os.includes('2019') ? '1809' : '1607',
        install_date: daysAgo(rand(90, 1200)),
        last_boot: staleDays ? daysAgo(staleDays) : hoursAgo(rand(1, 720)),
        activation_status: chance(95) ? 'Activated' : 'Not Activated',
        is_virtual: isVirtual,
        hypervisor: isVirtual ? pick(HYPERVISORS.filter(Boolean)) : null,
        cpu_model: pick(CPU_MODELS),
        cpu_cores: cpuCores,
        cpu_usage: cpuUsage,
        ram_total_gb: ramTotal,
        ram_used_gb: ramUsed,
        last_patch_date: daysAgo(rand(1, 60)),
        missing_critical_updates: missingUpdates,
        wsus_server: `wsus.${domainLower}.local`,
        reboot_pending: rebootPending,
        antivirus_product: 'Microsoft Defender',
        antivirus_status: pick(AV_STATUSES),
        bitlocker_status: chance(70) ? 'Enabled - XtsAes256' : 'Not Enabled',
        rdp_enabled: rdpEnabled,
        nla_enabled: nlaEnabled,
        last_admin_login: daysAgo(rand(0, 14)),
        last_user_login: chance(60) ? daysAgo(rand(0, 7)) : null,
        last_security_scan: daysAgo(rand(0, 7)),
        critical_events_24h: critEvents,
        cluster_health: chance(10) ? 'Healthy' : null,
        replication_health: prefix === 'DC' ? (chance(90) ? 'Healthy' : 'Warning') : null,
        ip_addresses: [
          { adapter_name: 'Ethernet0', ip_address: randIp(subnet), subnet_mask: '255.255.255.0', mac_address: randMac(), speed_mbps: pick([1000, 10000, 25000]) }
        ],
        disks: [
          { drive_letter: 'C:', volume_label: 'System', size_gb: pick([80, 100, 120, 200]), free_gb: rand(3, 60), file_system: 'NTFS' },
          ...(chance(70) ? [{ drive_letter: 'D:', volume_label: 'Data', size_gb: pick([200, 500, 1000, 2000]), free_gb: rand(5, 800), file_system: 'NTFS' }] : []),
          ...(chance(20) ? [{ drive_letter: 'E:', volume_label: 'Logs', size_gb: pick([100, 200]), free_gb: rand(2, 80), file_system: 'NTFS' }] : []),
        ],
        roles: ROLE_TYPES.filter(() => chance(20)).slice(0, rand(1, 4)),
        services: [
          { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' },
          { name: 'WinRM', display_name: 'Windows Remote Management', status: 'Running', start_type: 'Automatic' },
          ...(chance(50) ? [{ name: 'W3SVC', display_name: 'World Wide Web Publishing', status: pick(['Running', 'Stopped']), start_type: 'Automatic' }] : []),
        ],
        local_admins: [
          { account_name: `${domain}\\Domain Admins`, account_type: 'Group' },
          { account_name: 'Administrator', account_type: 'User' },
        ],
        missing_updates: Array.from({ length: missingUpdates }, (_, j) => ({
          kb_id: `KB${5000000 + rand(1, 99999)}`,
          title: `Security Update for ${pick(['Windows', '.NET', 'Edge', 'Office'])} - ${pick(['March', 'February', 'January'])} 2026`,
          severity: pick(['Critical', 'Important', 'Moderate']),
        })),
        event_errors: Array.from({ length: Math.min(critEvents, 5) }, () => ({
          log_name: pick(['System', 'Application', 'Security']),
          event_id: pick([1001, 7036, 6008, 1000, 4625, 36874]),
          source: pick(['Service Control Manager', 'Application Error', 'Schannel', 'DCOM', 'DistributedCOM']),
          message: pick([
            'The service terminated unexpectedly.',
            'Application error occurred.',
            'A fatal alert was received from the remote endpoint.',
            'Unable to start a DCOM Server.',
            'The DCOM permission settings do not grant activation permission.'
          ]),
          time_created: hoursAgo(rand(1, 24)),
        })),
        firewall_rules: [
          { name: 'RDP', direction: 'Inbound', action: rdpEnabled ? 'Allow' : 'Block', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: `${subnet}.0/24`, enabled: true, profile: 'Domain', rule_source: 'GPO' },
          { name: 'WinRM-HTTP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '5985', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain', rule_source: 'Local' },
        ],
        gpos: [
          { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
        ],
        local_policies: [
          { category: 'Audit Policy', policy_name: 'Audit Logon Events', setting: 'Success, Failure' },
          { category: 'Security Options', policy_name: 'Network access: Do not allow anonymous enumeration of SAM accounts', setting: 'Enabled' },
        ],
      };

      db.upsertServer(serverData);

      // Set maintenance if applicable
      if (maintMode) {
        const srv = db.getServer(hostname);
        if (srv) {
          db.setMaintenanceMode(srv.id, new Date(Date.now() + rand(1, 48) * 3600000).toISOString(), 'Scheduled maintenance', 'admin');
        }
      }

      // Set stale updated_at if applicable
      if (staleDays) {
        const staleDate = daysAgo(staleDays);
        d.prepare('UPDATE servers SET updated_at = ? WHERE hostname = ?').run(staleDate, hostname);
      }

      if (count % 100 === 0) process.stdout.write(`  ${count} servers...\n`);
    }
  }
  return count;
});

const total = insertAll();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Done! Inserted ${total} servers in ${elapsed}s`);
console.log(`Domains: ${DOMAINS.join(', ')}`);

// Verify
const stats = db.getDashboardStats();
console.log(`\nDashboard: ${stats.total} total, ${stats.rebootPending} reboot pending, ${stats.missingUpdates} missing updates`);
console.log(`Domain health:`, stats.domainHealth.map(d => `${d.domain}: ${d.total}`).join(', '));
