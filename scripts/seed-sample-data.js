// Seed script — inserts sample servers for demo / testing
// Usage: node scripts/seed-sample-data.js

const path = require('path');
process.chdir(path.join(__dirname, '..'));
const db = require('../db');

const sampleServers = [
  {
    hostname: 'DC01',
    fqdn: 'dc01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=Domain Controllers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2022 Datacenter',
    os_version: '10.0.20348',
    os_build: '21H2',
    install_date: '2023-06-15T08:30:00',
    last_boot: '2026-03-18T02:15:00',
    activation_status: 'Activated',
    is_virtual: true,
    hypervisor: 'Hyper-V',
    cpu_model: 'Intel Xeon E-2388G',
    cpu_cores: 4,
    cpu_usage: 18,
    ram_total_gb: 16,
    ram_used_gb: 9.4,
    last_patch_date: '2026-03-12T00:00:00',
    missing_critical_updates: 0,
    wsus_server: 'wsus01.contoso.local',
    reboot_pending: false,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Active',
    bitlocker_status: 'Enabled - XtsAes256',
    rdp_enabled: true,
    last_admin_login: '2026-03-20T09:12:00',
    last_user_login: null,
    critical_events_24h: 0,
    cluster_health: null,
    replication_health: 'Healthy',
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.1.10', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:11:22:33', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 52, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'Data', size_gb: 200, free_gb: 145, file_system: 'NTFS' }
    ],
    roles: [
      { name: 'Active Directory Domain Services', type: 'Role' },
      { name: 'DNS Server', type: 'Role' },
      { name: 'Group Policy Management', type: 'Feature' }
    ],
    services: [
      { name: 'NTDS', display_name: 'Active Directory Domain Services', status: 'Running', start_type: 'Automatic' },
      { name: 'DNS', display_name: 'DNS Server', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' },
      { name: 'Netlogon', display_name: 'Netlogon', status: 'Running', start_type: 'Automatic' },
      { name: 'DFSR', display_name: 'DFS Replication', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' }
    ],
    missing_updates: [],
    event_errors: [],
    firewall_rules: [
      { name: 'Active Directory - LDAP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '389', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'DNS (TCP)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '53', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'DNS (UDP)', direction: 'Inbound', action: 'Allow', protocol: 'UDP', local_port: '53', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'Kerberos (TCP)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '88', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'RDP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: '10.0.1.0/24', enabled: true, profile: 'Domain' },
      { name: 'Block External RDP', direction: 'Inbound', action: 'Block', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Public' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'Server Hardening Policy', gpo_status: 'Enabled', gpo_guid: '{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}', link_order: 2 },
      { gpo_name: 'Windows Update Policy', gpo_status: 'Enabled', gpo_guid: '{B2C3D4E5-F6A7-8901-BCDE-F12345678901}', link_order: 3 },
      { gpo_name: 'Audit Policy', gpo_status: 'Enabled', gpo_guid: '{C3D4E5F6-A7B8-9012-CDEF-012345678902}', link_order: 4 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Account Policies', policy_name: 'Password complexity', setting: 'Enabled' },
      { category: 'Account Policies', policy_name: 'Account lockout threshold', setting: '5' },
      { category: 'Audit Policy', policy_name: 'Audit logon events', setting: 'Success, Failure' },
      { category: 'Audit Policy', policy_name: 'Audit account management', setting: 'Success, Failure' },
      { category: 'Security Options', policy_name: 'Interactive logon: Do not display last user name', setting: 'Enabled' }
    ]
  },
  {
    hostname: 'WEB01',
    fqdn: 'web01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=Web Servers,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2022 Standard',
    os_version: '10.0.20348',
    os_build: '21H2',
    install_date: '2024-01-20T14:00:00',
    last_boot: '2026-03-19T06:30:00',
    activation_status: 'Activated',
    is_virtual: true,
    hypervisor: 'VMware',
    cpu_model: 'Intel Xeon Gold 6338',
    cpu_cores: 8,
    cpu_usage: 62,
    ram_total_gb: 32,
    ram_used_gb: 24.8,
    last_patch_date: '2026-03-12T00:00:00',
    missing_critical_updates: 2,
    wsus_server: 'wsus01.contoso.local',
    reboot_pending: true,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Active',
    bitlocker_status: 'Not Available',
    rdp_enabled: false,
    last_admin_login: '2026-03-19T15:30:00',
    critical_events_24h: 3,
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.2.20', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:22:33:44', speed_mbps: 10000 },
      { adapter_name: 'Ethernet1', ip_address: '10.0.3.20', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:22:33:45', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 35, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'WebApps', size_gb: 500, free_gb: 180, file_system: 'NTFS' },
      { drive_letter: 'E:', volume_label: 'Logs', size_gb: 200, free_gb: 22, file_system: 'NTFS' }
    ],
    roles: [
      { name: 'Web Server (IIS)', type: 'Role' },
      { name: '.NET Framework 4.8', type: 'Feature' },
      { name: 'Application Initialization', type: 'Feature' }
    ],
    services: [
      { name: 'W3SVC', display_name: 'World Wide Web Publishing Service', status: 'Running', start_type: 'Automatic' },
      { name: 'WAS', display_name: 'Windows Process Activation Service', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' },
      { name: 'WinRM', display_name: 'Windows Remote Management', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'CONTOSO\\WebServerAdmins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' }
    ],
    missing_updates: [
      { kb_id: 'KB5035857', title: '2026-03 Cumulative Update for Windows Server 2022', severity: 'Critical' },
      { kb_id: 'KB5034439', title: '2026-03 Security Update for .NET Framework', severity: 'Important' }
    ],
    event_errors: [
      { log_name: 'Application', event_id: 1000, source: 'W3SVC', message: 'Application pool DefaultAppPool crashed', time_created: '2026-03-20T08:15:00' },
      { log_name: 'System', event_id: 7034, source: 'Service Control Manager', message: 'The World Wide Web Publishing Service terminated unexpectedly', time_created: '2026-03-20T08:14:55' },
      { log_name: 'Application', event_id: 1309, source: 'ASP.NET', message: 'Unhandled exception in application pool', time_created: '2026-03-20T06:42:00' }
    ],
    firewall_rules: [
      { name: 'HTTP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '80', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'HTTPS', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '443', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'WinRM', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '5985', remote_port: 'Any', remote_address: '10.0.1.0/24', enabled: true, profile: 'Domain' },
      { name: 'Block All Outbound', direction: 'Outbound', action: 'Block', protocol: 'Any', local_port: 'Any', remote_port: 'Any', remote_address: 'Any', enabled: false, profile: 'Public' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'Web Server Hardening', gpo_status: 'Enabled', gpo_guid: '{D4E5F6A7-B8C9-0123-DEF0-123456789012}', link_order: 2 },
      { gpo_name: 'Windows Update Policy', gpo_status: 'Enabled', gpo_guid: '{B2C3D4E5-F6A7-8901-BCDE-F12345678901}', link_order: 3 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Security Options', policy_name: 'Network access: Do not allow anonymous enumeration of SAM accounts', setting: 'Enabled' }
    ]
  },
  {
    hostname: 'SQL01',
    fqdn: 'sql01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=SQL Servers,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2019 Standard',
    os_version: '10.0.17763',
    os_build: '1809',
    install_date: '2022-03-10T09:00:00',
    last_boot: '2026-03-15T03:00:00',
    activation_status: 'Activated',
    is_virtual: true,
    hypervisor: 'VMware',
    cpu_model: 'Intel Xeon Gold 6338',
    cpu_cores: 16,
    cpu_usage: 45,
    ram_total_gb: 64,
    ram_used_gb: 52.3,
    last_patch_date: '2026-02-14T00:00:00',
    missing_critical_updates: 1,
    wsus_server: 'wsus01.contoso.local',
    reboot_pending: false,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Active',
    bitlocker_status: 'Not Available',
    rdp_enabled: true,
    last_admin_login: '2026-03-20T10:00:00',
    critical_events_24h: 0,
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.2.30', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:33:44:55', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 60, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'SQLData', size_gb: 1000, free_gb: 320, file_system: 'NTFS' },
      { drive_letter: 'E:', volume_label: 'SQLLogs', size_gb: 500, free_gb: 380, file_system: 'NTFS' },
      { drive_letter: 'F:', volume_label: 'TempDB', size_gb: 200, free_gb: 185, file_system: 'NTFS' },
      { drive_letter: 'G:', volume_label: 'Backup', size_gb: 2000, free_gb: 450, file_system: 'ReFS' }
    ],
    roles: [
      { name: '.NET Framework 4.8', type: 'Feature' },
      { name: 'Failover Clustering', type: 'Feature' }
    ],
    services: [
      { name: 'MSSQLSERVER', display_name: 'SQL Server (MSSQLSERVER)', status: 'Running', start_type: 'Automatic' },
      { name: 'SQLSERVERAGENT', display_name: 'SQL Server Agent (MSSQLSERVER)', status: 'Running', start_type: 'Automatic' },
      { name: 'MsDtsServer160', display_name: 'SQL Server Integration Services', status: 'Running', start_type: 'Automatic' },
      { name: 'ReportServer', display_name: 'SQL Server Reporting Services', status: 'Stopped', start_type: 'Manual' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' },
      { name: 'WinRM', display_name: 'Windows Remote Management', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'CONTOSO\\SQLAdmins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' },
      { account_name: 'CONTOSO\\svc-sql', account_type: 'User' }
    ],
    missing_updates: [
      { kb_id: 'KB5035849', title: '2026-02 Cumulative Update for Windows Server 2019', severity: 'Critical' }
    ],
    event_errors: [],
    firewall_rules: [
      { name: 'SQL Server', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '1433', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'SQL Browser', direction: 'Inbound', action: 'Allow', protocol: 'UDP', local_port: '1434', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'RDP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: '10.0.1.0/24', enabled: true, profile: 'Domain' },
      { name: 'Block Internet', direction: 'Outbound', action: 'Block', protocol: 'TCP', local_port: 'Any', remote_port: '80,443', remote_address: 'Any', enabled: true, profile: 'Domain' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'SQL Server Hardening', gpo_status: 'Enabled', gpo_guid: '{E5F6A7B8-C9D0-1234-EF01-234567890123}', link_order: 2 },
      { gpo_name: 'Audit Policy', gpo_status: 'Enabled', gpo_guid: '{C3D4E5F6-A7B8-9012-CDEF-012345678902}', link_order: 3 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Account Policies', policy_name: 'Account lockout threshold', setting: '3' },
      { category: 'Audit Policy', policy_name: 'Audit logon events', setting: 'Success, Failure' },
      { category: 'Audit Policy', policy_name: 'Audit object access', setting: 'Success, Failure' },
      { category: 'Security Options', policy_name: 'Accounts: Rename administrator account', setting: 'SQLLocalAdmin' }
    ]
  },
  {
    hostname: 'FILE01',
    fqdn: 'file01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=File Servers,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2022 Standard',
    os_version: '10.0.20348',
    os_build: '21H2',
    install_date: '2023-09-01T10:00:00',
    last_boot: '2026-03-17T04:00:00',
    activation_status: 'Activated',
    is_virtual: false,
    hypervisor: null,
    cpu_model: 'Intel Xeon E-2388G',
    cpu_cores: 8,
    cpu_usage: 12,
    ram_total_gb: 32,
    ram_used_gb: 8.6,
    last_patch_date: '2026-03-12T00:00:00',
    missing_critical_updates: 0,
    reboot_pending: false,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Active',
    bitlocker_status: 'Enabled - XtsAes256',
    rdp_enabled: false,
    last_admin_login: '2026-03-18T09:00:00',
    critical_events_24h: 0,
    cluster_health: null,
    ip_addresses: [
      { adapter_name: 'NIC1', ip_address: '10.0.2.40', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:44:55:66', speed_mbps: 10000 },
      { adapter_name: 'NIC2', ip_address: '10.0.2.41', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:44:55:67', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 72, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'SharedData', size_gb: 4000, free_gb: 1200, file_system: 'ReFS' },
      { drive_letter: 'E:', volume_label: 'UserProfiles', size_gb: 2000, free_gb: 350, file_system: 'ReFS' }
    ],
    roles: [
      { name: 'File and Storage Services', type: 'Role' },
      { name: 'Data Deduplication', type: 'Feature' },
      { name: 'DFS Namespaces', type: 'Role' },
      { name: 'File Server Resource Manager', type: 'Role' }
    ],
    services: [
      { name: 'LanmanServer', display_name: 'Server', status: 'Running', start_type: 'Automatic' },
      { name: 'Dfs', display_name: 'DFS Namespace', status: 'Running', start_type: 'Automatic' },
      { name: 'DFSR', display_name: 'DFS Replication', status: 'Running', start_type: 'Automatic' },
      { name: 'SrmSvc', display_name: 'File Server Resource Manager', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' }
    ],
    missing_updates: [],
    event_errors: [],
    firewall_rules: [
      { name: 'File and Printer Sharing (SMB-In)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '445', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'DFS Management (DCOM-In)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '135', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'DFS Replication (RPC)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '5722', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'File Server Policy', gpo_status: 'Enabled', gpo_guid: '{F6A7B8C9-D0E1-2345-F012-345678901234}', link_order: 2 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Audit Policy', policy_name: 'Audit object access', setting: 'Success, Failure' }
    ]
  },
  {
    hostname: 'APP01',
    fqdn: 'app01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=Application Servers,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2022 Standard',
    os_version: '10.0.20348',
    os_build: '21H2',
    install_date: '2024-06-01T12:00:00',
    last_boot: '2026-03-19T03:00:00',
    activation_status: 'Activated',
    is_virtual: true,
    hypervisor: 'Hyper-V',
    cpu_model: 'AMD EPYC 7763',
    cpu_cores: 8,
    cpu_usage: 78,
    ram_total_gb: 32,
    ram_used_gb: 28.1,
    last_patch_date: '2026-03-12T00:00:00',
    missing_critical_updates: 0,
    reboot_pending: false,
    antivirus_product: 'CrowdStrike Falcon',
    antivirus_status: 'Active',
    bitlocker_status: 'Not Available',
    rdp_enabled: true,
    last_admin_login: '2026-03-20T11:30:00',
    critical_events_24h: 1,
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.2.50', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:55:66:77', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 45, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'Applications', size_gb: 300, free_gb: 120, file_system: 'NTFS' }
    ],
    roles: [
      { name: 'Web Server (IIS)', type: 'Role' },
      { name: '.NET Framework 4.8', type: 'Feature' },
      { name: 'Windows Server Backup', type: 'Feature' }
    ],
    services: [
      { name: 'W3SVC', display_name: 'World Wide Web Publishing Service', status: 'Running', start_type: 'Automatic' },
      { name: 'WAS', display_name: 'Windows Process Activation Service', status: 'Running', start_type: 'Automatic' },
      { name: 'CustomAppSvc', display_name: 'Contoso Business Application', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' },
      { name: 'WinRM', display_name: 'Windows Remote Management', status: 'Running', start_type: 'Automatic' },
      { name: 'wuauserv', display_name: 'Windows Update', status: 'Stopped', start_type: 'Manual' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'CONTOSO\\AppAdmins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' },
      { account_name: 'CONTOSO\\svc-app', account_type: 'User' }
    ],
    missing_updates: [],
    event_errors: [
      { log_name: 'Application', event_id: 1026, source: '.NET Runtime', message: 'Application: ContosoApp.exe Framework Version: v4.0 - Fatal Execution Engine Error', time_created: '2026-03-20T04:22:00' }
    ],
    firewall_rules: [
      { name: 'HTTP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '80', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'HTTPS', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '443', remote_port: 'Any', remote_address: 'Any', enabled: true, profile: 'Domain' },
      { name: 'Custom App Port', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '8080', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'RDP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: '10.0.1.0/24', enabled: true, profile: 'Domain' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'Application Server Policy', gpo_status: 'Enabled', gpo_guid: '{A7B8C9D0-E1F2-3456-0123-456789012345}', link_order: 2 },
      { gpo_name: 'Windows Update Policy', gpo_status: 'Enabled', gpo_guid: '{B2C3D4E5-F6A7-8901-BCDE-F12345678901}', link_order: 3 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Security Options', policy_name: 'Interactive logon: Machine inactivity limit', setting: '900' },
      { category: 'Security Options', policy_name: 'User Account Control: Run all administrators in Admin Approval Mode', setting: 'Enabled' }
    ]
  },
  {
    hostname: 'BACKUP01',
    fqdn: 'backup01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=Infrastructure,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2019 Standard',
    os_version: '10.0.17763',
    os_build: '1809',
    install_date: '2021-11-05T16:00:00',
    last_boot: '2026-03-10T02:00:00',
    activation_status: 'Activated',
    is_virtual: false,
    hypervisor: null,
    cpu_model: 'Intel Xeon E-2288G',
    cpu_cores: 8,
    cpu_usage: 5,
    ram_total_gb: 32,
    ram_used_gb: 6.2,
    last_patch_date: '2026-01-15T00:00:00',
    missing_critical_updates: 4,
    reboot_pending: true,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Out of Date',
    bitlocker_status: 'Enabled - Aes256',
    rdp_enabled: true,
    last_admin_login: '2026-02-28T14:00:00',
    critical_events_24h: 2,
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.2.60', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:66:77:88', speed_mbps: 10000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 100, free_gb: 55, file_system: 'NTFS' },
      { drive_letter: 'D:', volume_label: 'BackupTarget', size_gb: 8000, free_gb: 800, file_system: 'ReFS' }
    ],
    roles: [
      { name: 'Windows Server Backup', type: 'Feature' }
    ],
    services: [
      { name: 'VeeamBackupSvc', display_name: 'Veeam Backup Service', status: 'Running', start_type: 'Automatic' },
      { name: 'VeeamTransportSvc', display_name: 'Veeam Data Mover', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Stopped', start_type: 'Disabled' },
      { name: 'WinRM', display_name: 'Windows Remote Management', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'CONTOSO\\BackupAdmins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' },
      { account_name: 'CONTOSO\\svc-backup', account_type: 'User' },
      { account_name: 'CONTOSO\\vendor-support', account_type: 'User' }
    ],
    missing_updates: [
      { kb_id: 'KB5035849', title: '2026-02 Cumulative Update for Windows Server 2019', severity: 'Critical' },
      { kb_id: 'KB5034439', title: '2026-01 Windows Recovery Environment Update', severity: 'Critical' },
      { kb_id: 'KB5033904', title: '2025-12 .NET Framework Security Update', severity: 'Important' },
      { kb_id: 'KB5034129', title: '2026-01 Servicing Stack Update', severity: 'Critical' }
    ],
    event_errors: [
      { log_name: 'Application', event_id: 3041, source: 'VeeamBackup', message: 'Backup job "Daily-FileServer" failed: Unable to connect to repository', time_created: '2026-03-20T02:15:00' },
      { log_name: 'System', event_id: 7, source: 'Disk', message: 'The device, \\Device\\Harddisk1\\DR1, has a bad block', time_created: '2026-03-19T22:00:00' }
    ],
    firewall_rules: [
      { name: 'Veeam Backup Port', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '9392', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'Veeam Data Mover', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '2500-3300', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'RDP', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '3389', remote_port: 'Any', remote_address: '10.0.1.0/24', enabled: true, profile: 'Domain' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'Server Hardening Policy', gpo_status: 'Enabled', gpo_guid: '{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}', link_order: 2 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '14' },
      { category: 'Account Policies', policy_name: 'Account lockout threshold', setting: '5' }
    ]
  },
  {
    hostname: 'PRINT01',
    fqdn: 'print01.contoso.local',
    domain_or_workgroup: 'CONTOSO',
    domain_type: 'Domain',
    ou: 'OU=Infrastructure,OU=Servers,DC=contoso,DC=local',
    os_edition: 'Windows Server 2016 Standard',
    os_version: '10.0.14393',
    os_build: '1607',
    install_date: '2019-04-20T08:00:00',
    last_boot: '2026-03-01T05:00:00',
    activation_status: 'Activated',
    is_virtual: true,
    hypervisor: 'Hyper-V',
    cpu_model: 'Intel Xeon E-2388G',
    cpu_cores: 2,
    cpu_usage: 3,
    ram_total_gb: 4,
    ram_used_gb: 2.1,
    last_patch_date: '2026-02-14T00:00:00',
    missing_critical_updates: 0,
    reboot_pending: false,
    antivirus_product: 'Microsoft Defender',
    antivirus_status: 'Active',
    bitlocker_status: 'Not Available',
    rdp_enabled: false,
    last_admin_login: '2026-03-05T09:00:00',
    critical_events_24h: 0,
    ip_addresses: [
      { adapter_name: 'Ethernet0', ip_address: '10.0.2.70', subnet_mask: '255.255.255.0', mac_address: 'AA:BB:CC:77:88:99', speed_mbps: 1000 }
    ],
    disks: [
      { drive_letter: 'C:', volume_label: 'System', size_gb: 60, free_gb: 38, file_system: 'NTFS' }
    ],
    roles: [
      { name: 'Print and Document Services', type: 'Role' }
    ],
    services: [
      { name: 'Spooler', display_name: 'Print Spooler', status: 'Running', start_type: 'Automatic' },
      { name: 'W32Time', display_name: 'Windows Time', status: 'Running', start_type: 'Automatic' }
    ],
    local_admins: [
      { account_name: 'CONTOSO\\Domain Admins', account_type: 'Group' },
      { account_name: 'Administrator', account_type: 'User' }
    ],
    missing_updates: [],
    event_errors: [],
    firewall_rules: [
      { name: 'Print Spooler (RPC)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '135', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' },
      { name: 'File and Printer Sharing (SMB-In)', direction: 'Inbound', action: 'Allow', protocol: 'TCP', local_port: '445', remote_port: 'Any', remote_address: '10.0.0.0/8', enabled: true, profile: 'Domain' }
    ],
    gpos: [
      { gpo_name: 'Default Domain Policy', gpo_status: 'Enabled', gpo_guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', link_order: 1 },
      { gpo_name: 'Print Server GPO', gpo_status: 'Enabled', gpo_guid: '{B8C9D0E1-F2A3-4567-0123-567890123456}', link_order: 2 }
    ],
    local_policies: [
      { category: 'Account Policies', policy_name: 'Minimum password length', setting: '12' }
    ]
  }
];

// --- Insert all sample servers ---
console.log('Seeding sample servers...');
let inserted = 0;
for (const server of sampleServers) {
  try {
    const id = db.upsertServer(server);
    console.log(`  [OK] ${server.hostname} => ID ${id}`);
    inserted++;
  } catch (e) {
    console.error(`  [FAIL] ${server.hostname}: ${e.message}`);
  }
}
console.log(`Done. ${inserted}/${sampleServers.length} servers seeded.`);

// --- Seed historical disk and snapshot data ---
console.log('\nSeeding historical disk trends and CPU/RAM snapshots (30 days)...');
const d = db.getDb();

// Clear old history to avoid duplicates on re-run
d.exec('DELETE FROM disk_history');
d.exec('DELETE FROM server_snapshots');

const now = Date.now();
const DAY = 86400000;
const DAYS = 30;

// Per-server history profiles: defines how disk usage and CPU/RAM change over time
const historyProfiles = {
  DC01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 78, freeEnd: 72 },
      { drive: 'D:', size: 200, freeStart: 170, freeEnd: 155 }
    ],
    cpuBase: 14, cpuVar: 10, ramBase: 8.5, ramVar: 2
  },
  WEB01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 72, freeEnd: 55 },
      { drive: 'D:', size: 500, freeStart: 380, freeEnd: 320 },
      { drive: 'E:', size: 200, freeStart: 80, freeEnd: 22 }
    ],
    cpuBase: 40, cpuVar: 25, ramBase: 26, ramVar: 4
  },
  SQL01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 72, freeEnd: 60 },
      { drive: 'D:', size: 1000, freeStart: 520, freeEnd: 320 },
      { drive: 'E:', size: 500, freeStart: 420, freeEnd: 380 },
      { drive: 'F:', size: 200, freeStart: 195, freeEnd: 185 },
      { drive: 'G:', size: 2000, freeStart: 900, freeEnd: 450 }
    ],
    cpuBase: 55, cpuVar: 20, ramBase: 55, ramVar: 6
  },
  FILE01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 82, freeEnd: 72 },
      { drive: 'D:', size: 4000, freeStart: 2200, freeEnd: 1200 },
      { drive: 'E:', size: 2000, freeStart: 800, freeEnd: 350 }
    ],
    cpuBase: 8, cpuVar: 8, ramBase: 7, ramVar: 3
  },
  APP01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 62, freeEnd: 45 },
      { drive: 'D:', size: 300, freeStart: 200, freeEnd: 120 }
    ],
    cpuBase: 60, cpuVar: 25, ramBase: 24, ramVar: 5
  },
  BACKUP01: {
    disks: [
      { drive: 'C:', size: 100, freeStart: 68, freeEnd: 55 },
      { drive: 'D:', size: 8000, freeStart: 3500, freeEnd: 800 }
    ],
    cpuBase: 3, cpuVar: 8, ramBase: 5, ramVar: 2
  },
  PRINT01: {
    disks: [
      { drive: 'C:', size: 60, freeStart: 45, freeEnd: 38 }
    ],
    cpuBase: 2, cpuVar: 3, ramBase: 1.8, ramVar: 0.5
  }
};

const insDisk = d.prepare('INSERT INTO disk_history (server_id, drive_letter, size_gb, free_gb, recorded_at) VALUES (?,?,?,?,?)');
const insSnap = d.prepare('INSERT INTO server_snapshots (server_id, cpu_usage, ram_used_gb, recorded_at) VALUES (?,?,?,?)');

const insertAll = d.transaction(() => {
  for (const server of sampleServers) {
    const row = d.prepare('SELECT id FROM servers WHERE hostname = ?').get(server.hostname);
    if (!row) continue;
    const serverId = row.id;
    const profile = historyProfiles[server.hostname];
    if (!profile) continue;

    for (let day = DAYS; day >= 0; day--) {
      const ts = new Date(now - day * DAY).toISOString();

      // Disk history — linear decline from freeStart to freeEnd with small noise
      for (const disk of profile.disks) {
        const progress = (DAYS - day) / DAYS;
        const baseFree = disk.freeStart - (disk.freeStart - disk.freeEnd) * progress;
        const noise = (Math.random() - 0.5) * 2 * (disk.size * 0.005);
        const free = Math.max(0, Math.min(disk.size, Math.round((baseFree + noise) * 10) / 10));
        insDisk.run(serverId, disk.drive, disk.size, free, ts);
      }

      // CPU/RAM snapshots
      const cpu = Math.max(0, Math.min(100, Math.round(profile.cpuBase + (Math.random() - 0.5) * 2 * profile.cpuVar)));
      const ram = Math.max(0, Math.round((profile.ramBase + (Math.random() - 0.5) * 2 * profile.ramVar) * 10) / 10);
      insSnap.run(serverId, cpu, ram, ts);
    }
    console.log(`  [OK] ${server.hostname} — ${DAYS + 1} days of history`);
  }
});

insertAll();
console.log('Historical data seeding complete.');
