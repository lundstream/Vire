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

// --- Seed Domain GPOs (domain-level, via upsertDomainGPOs) ---
console.log('\nSeeding domain GPO data...');

const domainGpoData = {
  CONTOSO: [
    { name: 'Default Domain Policy', guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', status: 'All settings enabled',
      description: 'Default domain-wide policy for all objects', creation_time: '2023-06-15T08:30:00', modification_time: '2026-02-10T14:22:00',
      links: [{ target: 'DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Minimum password length', value: '14' },
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Maximum password age', value: '90 days' },
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Enforce password history', value: '24 passwords' },
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Password must meet complexity', value: 'Enabled' },
        { area: 'Computer', category: 'Account Policies / Lockout Policy', name: 'Account lockout threshold', value: '5 invalid logon attempts' },
        { area: 'Computer', category: 'Account Policies / Lockout Policy', name: 'Account lockout duration', value: '30 minutes' }
      ]
    },
    { name: 'Server Hardening Policy', guid: '{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}', status: 'All settings enabled',
      description: 'Baseline security hardening for all servers', creation_time: '2023-08-20T10:00:00', modification_time: '2026-03-01T09:15:00',
      links: [{ target: 'OU=Servers,DC=contoso,DC=local', enabled: true, enforced: true, order: 1 },
              { target: 'OU=Domain Controllers,DC=contoso,DC=local', enabled: true, enforced: false, order: 2 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Local Policies', name: 'Audit logon events', value: 'Success, Failure' },
        { area: 'Computer', category: 'Security Settings / Local Policies', name: 'Audit account management', value: 'Success, Failure' },
        { area: 'Computer', category: 'Security Settings / Local Policies', name: 'Audit policy change', value: 'Success, Failure' },
        { area: 'Computer', category: 'Security Settings / Security Options', name: 'Interactive logon: Do not display last user name', value: 'Enabled' },
        { area: 'Computer', category: 'Security Settings / Security Options', name: 'Network access: Do not allow anonymous enumeration of SAM accounts', value: 'Enabled' },
        { area: 'Computer', category: 'Security Settings / Security Options', name: 'Network security: LAN Manager authentication level', value: 'Send NTLMv2 response only. Refuse LM & NTLM' },
        { area: 'Computer', category: 'Windows Settings / Security Settings', name: 'Windows Firewall: Domain Profile state', value: 'On' },
        { area: 'Computer', category: 'Windows Settings / Security Settings', name: 'Windows Firewall: Allow inbound RDP', value: 'Management subnet only' }
      ]
    },
    { name: 'Windows Update Policy', guid: '{B2C3D4E5-F6A7-8901-BCDE-F12345678901}', status: 'All settings enabled',
      description: 'WSUS auto-update configuration', creation_time: '2023-09-01T08:00:00', modification_time: '2026-01-15T11:30:00',
      links: [{ target: 'OU=Servers,DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Configure Automatic Updates', value: '4 - Auto download and schedule install' },
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Scheduled install day', value: 'Every Sunday' },
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Scheduled install time', value: '03:00' },
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Specify intranet Microsoft update service location', value: 'https://wsus01.contoso.local:8531' }
      ]
    },
    { name: 'Audit Policy', guid: '{C3D4E5F6-A7B8-9012-CDEF-012345678902}', status: 'All settings enabled',
      description: 'Advanced audit policy for compliance logging', creation_time: '2024-01-10T09:00:00', modification_time: '2026-02-20T16:45:00',
      links: [{ target: 'DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Advanced Audit Policy / Account Logon', name: 'Audit Credential Validation', value: 'Success and Failure' },
        { area: 'Computer', category: 'Advanced Audit Policy / Account Logon', name: 'Audit Kerberos Authentication Service', value: 'Success and Failure' },
        { area: 'Computer', category: 'Advanced Audit Policy / Logon/Logoff', name: 'Audit Logon', value: 'Success and Failure' },
        { area: 'Computer', category: 'Advanced Audit Policy / Logon/Logoff', name: 'Audit Special Logon', value: 'Success' },
        { area: 'Computer', category: 'Advanced Audit Policy / Object Access', name: 'Audit File System', value: 'Success and Failure' },
        { area: 'Computer', category: 'Advanced Audit Policy / Privilege Use', name: 'Audit Sensitive Privilege Use', value: 'Success and Failure' }
      ]
    },
    { name: 'Web Server Hardening', guid: '{D4E5F6A7-B8C9-0123-DEF0-123456789012}', status: 'All settings enabled',
      description: 'IIS-specific security and TLS configuration', creation_time: '2024-02-15T10:30:00', modification_time: '2026-02-28T08:00:00',
      links: [{ target: 'OU=Web Servers,OU=Servers,DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Network / SSL', name: 'SSL Cipher Suite Order', value: 'TLS_AES_256_GCM_SHA384,TLS_AES_128_GCM_SHA256' },
        { area: 'Computer', category: 'Administrative Templates / Network / SSL', name: 'Minimum TLS version', value: 'TLS 1.2' },
        { area: 'Computer', category: 'Security Settings / Software Restriction', name: 'Disallowed executables', value: 'cmd.exe, powershell.exe for IIS_IUSRS' }
      ]
    },
    { name: 'SQL Server Hardening', guid: '{E5F6A7B8-C9D0-1234-EF01-234567890123}', status: 'All settings enabled',
      description: 'Database server security and network restrictions', creation_time: '2024-03-01T14:00:00', modification_time: '2026-01-20T10:00:00',
      links: [{ target: 'OU=SQL Servers,OU=Servers,DC=contoso,DC=local', enabled: true, enforced: true, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Firewall', name: 'Allow SQL port 1433', value: 'Inbound from 10.0.0.0/8 only' },
        { area: 'Computer', category: 'Security Settings / Firewall', name: 'Block outbound internet', value: 'TCP 80,443 to Any' },
        { area: 'Computer', category: 'Security Settings / Local Policies', name: 'Deny log on locally', value: 'Guests, NT AUTHORITY\\Local Account' }
      ]
    },
    { name: 'File Server Policy', guid: '{F6A7B8C9-D0E1-2345-F012-345678901234}', status: 'All settings enabled',
      description: 'DFS, file screening, and access-based enumeration', creation_time: '2023-10-15T11:00:00', modification_time: '2025-12-01T09:30:00',
      links: [{ target: 'OU=File Servers,OU=Servers,DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Network / Lanman Server', name: 'Enable access-based enumeration', value: 'Enabled' },
        { area: 'Computer', category: 'Administrative Templates / System / Disk Quotas', name: 'Enable disk quotas', value: 'Enabled' },
        { area: 'Computer', category: 'Administrative Templates / System / Disk Quotas', name: 'Default quota limit', value: '50 GB' }
      ]
    },
    { name: 'BitLocker Encryption Policy', guid: '{A7B8C9D0-E1F2-3456-0123-456789012345}', status: 'All settings enabled',
      description: 'Enforce BitLocker on system drives', creation_time: '2024-06-01T08:00:00', modification_time: '2026-01-05T12:00:00',
      links: [{ target: 'OU=Servers,DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / BitLocker / OS Drives', name: 'Require additional authentication at startup', value: 'Enabled (TPM required)' },
        { area: 'Computer', category: 'Administrative Templates / BitLocker / OS Drives', name: 'Encryption method', value: 'XTS-AES 256-bit' }
      ]
    },
    { name: 'Remote Desktop Restrictions', guid: '{B8C9D0E1-F2A3-4567-0123-567890123456}', status: 'All settings enabled',
      description: 'Restrict RDP access and enforce NLA', creation_time: '2024-04-10T09:00:00', modification_time: '2026-03-05T14:30:00',
      links: [{ target: 'DC=contoso,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Remote Desktop Services', name: 'Require Network Level Authentication', value: 'Enabled' },
        { area: 'Computer', category: 'Administrative Templates / Remote Desktop Services', name: 'Set client connection encryption level', value: 'High Level' },
        { area: 'Computer', category: 'Administrative Templates / Remote Desktop Services', name: 'Session idle timeout', value: '15 minutes' }
      ]
    }
  ],
  FABRIKAM: [
    { name: 'Default Domain Policy', guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', status: 'All settings enabled',
      description: 'Default domain-wide policy', creation_time: '2022-01-10T08:00:00', modification_time: '2025-11-20T10:00:00',
      links: [{ target: 'DC=fabrikam,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Minimum password length', value: '12' },
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Maximum password age', value: '60 days' },
        { area: 'Computer', category: 'Account Policies / Lockout Policy', name: 'Account lockout threshold', value: '10 invalid logon attempts' }
      ]
    },
    { name: 'Web Server Hardening', guid: '{D4E5F6A7-B8C9-0123-DEF0-FABFABFAB012}', status: 'All settings enabled',
      description: 'IIS security for web tier', creation_time: '2023-03-15T09:30:00', modification_time: '2026-01-12T11:00:00',
      links: [{ target: 'OU=Web Servers,DC=fabrikam,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Network / SSL', name: 'Minimum TLS version', value: 'TLS 1.2' },
        { area: 'Computer', category: 'Security Settings / IIS', name: 'Remove default web site', value: 'Enabled' }
      ]
    },
    { name: 'App Server Baseline', guid: '{E5F6A7B8-C9D0-1234-EF01-FABFABFAB123}', status: 'All settings enabled',
      description: 'Application server security baseline', creation_time: '2023-06-01T13:00:00', modification_time: '2026-02-14T09:30:00',
      links: [{ target: 'OU=Application Servers,DC=fabrikam,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Local Policies', name: 'Audit process creation', value: 'Enabled (include command line)' },
        { area: 'Computer', category: 'Administrative Templates / System', name: 'Enable PowerShell Script Block Logging', value: 'Enabled' },
        { area: 'Computer', category: 'Administrative Templates / System', name: 'Enable PowerShell Transcription', value: 'Enabled (output to \\\\fs01\\logs\\ps)' }
      ]
    },
    { name: 'Windows Update Policy', guid: '{B2C3D4E5-F6A7-8901-BCDE-FABFABFAB901}', status: 'All settings enabled',
      description: 'WSUS configuration for Fabrikam', creation_time: '2022-04-01T08:00:00', modification_time: '2025-12-10T08:45:00',
      links: [{ target: 'DC=fabrikam,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Configure Automatic Updates', value: '3 - Auto download and notify for install' },
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Specify intranet Microsoft update service location', value: 'https://wsus.fabrikam.local:8531' }
      ]
    },
    { name: 'Firewall Baseline', guid: '{C3D4E5F6-A7B8-9012-CDEF-FABFABFAB456}', status: 'All settings enabled',
      description: 'Domain-wide firewall rules baseline', creation_time: '2023-09-20T15:00:00', modification_time: '2026-02-01T16:20:00',
      links: [{ target: 'DC=fabrikam,DC=local', enabled: true, enforced: true, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Windows Settings / Security Settings', name: 'Windows Firewall: Domain Profile state', value: 'On' },
        { area: 'Computer', category: 'Windows Settings / Security Settings', name: 'Windows Firewall: Block all inbound by default', value: 'Enabled' },
        { area: 'Computer', category: 'Windows Settings / Security Settings', name: 'Windows Firewall: Allow WinRM', value: '10.0.0.0/8' }
      ]
    },
    { name: 'Restricted Groups', guid: '{F6A7B8C9-D0E1-2345-F012-FABFABFAB789}', status: 'Computer settings disabled',
      description: 'Control local admin group membership', creation_time: '2024-01-15T10:00:00', modification_time: '2025-10-30T14:45:00',
      links: [{ target: 'OU=Servers,DC=fabrikam,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Restricted Groups', name: 'Administrators', value: 'FABRIKAM\\Domain Admins, FABRIKAM\\Server Admins' },
        { area: 'Computer', category: 'Security Settings / Restricted Groups', name: 'Remote Desktop Users', value: 'FABRIKAM\\RDP_Users' }
      ]
    }
  ],
  NORTHWIND: [
    { name: 'Default Domain Policy', guid: '{31B2F340-016D-11D2-945F-00C04FB984F9}', status: 'All settings enabled',
      description: 'Default domain policy', creation_time: '2021-05-01T08:00:00', modification_time: '2025-08-15T11:00:00',
      links: [{ target: 'DC=northwind,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Minimum password length', value: '10' },
        { area: 'Computer', category: 'Account Policies / Password Policy', name: 'Maximum password age', value: '120 days' },
        { area: 'Computer', category: 'Account Policies / Lockout Policy', name: 'Account lockout threshold', value: '5 invalid logon attempts' }
      ]
    },
    { name: 'ERP Server Policy', guid: '{A1B2C3D4-E5F6-7890-ABCD-NWNWNWNW0001}', status: 'All settings enabled',
      description: 'ERP application server configuration', creation_time: '2022-06-10T14:00:00', modification_time: '2026-01-28T09:15:00',
      links: [{ target: 'OU=ERP,OU=Servers,DC=northwind,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Firewall', name: 'Allow ERP port 8443', value: 'Inbound from 192.168.0.0/16 only' },
        { area: 'Computer', category: 'Administrative Templates / System', name: 'Maximum log file size (Application)', value: '256 MB' },
        { area: 'Computer', category: 'Administrative Templates / System', name: 'Enable crash dump collection', value: 'Full memory dump' }
      ]
    },
    { name: 'Citrix Session Policy', guid: '{B2C3D4E5-F6A7-8901-BCDE-NWNWNWNW0002}', status: 'All settings enabled',
      description: 'Citrix session host publishing and security', creation_time: '2022-09-01T10:00:00', modification_time: '2026-02-05T16:30:00',
      links: [{ target: 'OU=Citrix,OU=Servers,DC=northwind,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'User', category: 'Administrative Templates / Citrix / Session', name: 'Session idle timeout', value: '30 minutes' },
        { area: 'User', category: 'Administrative Templates / Citrix / Session', name: 'Disconnected session timeout', value: '60 minutes' },
        { area: 'Computer', category: 'Administrative Templates / Citrix / Publishing', name: 'Published applications', value: 'ERP Client, Office 365, SAP GUI' }
      ]
    },
    { name: 'Windows Update Policy', guid: '{C3D4E5F6-A7B8-9012-CDEF-NWNWNWNW0003}', status: 'All settings enabled',
      description: 'Patch management via WSUS', creation_time: '2021-08-01T08:00:00', modification_time: '2025-11-01T09:00:00',
      links: [{ target: 'DC=northwind,DC=local', enabled: true, enforced: false, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Configure Automatic Updates', value: '2 - Notify for download and auto install' },
        { area: 'Computer', category: 'Administrative Templates / Windows Update', name: 'Specify intranet Microsoft update service location', value: 'http://wsus.northwind.local:8530' }
      ]
    },
    { name: 'Backup Network Policy', guid: '{D4E5F6A7-B8C9-0123-DEF0-NWNWNWNW0004}', status: 'User settings disabled',
      description: 'Isolate backup traffic to dedicated VLAN', creation_time: '2023-04-12T10:00:00', modification_time: '2025-09-15T13:00:00',
      links: [{ target: 'OU=Backup,OU=Servers,DC=northwind,DC=local', enabled: true, enforced: true, order: 1 }],
      settings: [
        { area: 'Computer', category: 'Security Settings / Firewall', name: 'Allow Veeam port 9392', value: 'Inbound from backup VLAN 192.168.100.0/24' },
        { area: 'Computer', category: 'Security Settings / Firewall', name: 'Block all other inbound', value: 'Default deny' }
      ]
    }
  ]
};

for (const [domain, gpos] of Object.entries(domainGpoData)) {
  try {
    db.upsertDomainGPOs(domain, gpos);
    console.log(`  [OK] ${domain} — ${gpos.length} GPOs`);
  } catch (e) {
    console.error(`  [FAIL] ${domain}: ${e.message}`);
  }
}
console.log('Domain GPO data seeding complete.');

// --- Seed DNS zones and records ---
console.log('\nSeeding DNS zone data...');

const dnsData = {
  CONTOSO: [
    {
      name: 'contoso.local', type: 'Primary', is_reverse_lookup: false, is_ad_integrated: true,
      dynamic_update: 'Secure', aging_enabled: true, record_count: 18,
      records: [
        { name: '@', type: 'SOA', data: 'dc01.contoso.local admin.contoso.local', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'dc01.contoso.local', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'dc02.contoso.local', ttl: '01:00:00' },
        { name: '@', type: 'A', data: '10.0.1.10', ttl: '00:20:00' },
        { name: 'dc01', type: 'A', data: '10.0.1.10', ttl: '00:20:00' },
        { name: 'dc02', type: 'A', data: '10.0.1.11', ttl: '00:20:00' },
        { name: 'web01', type: 'A', data: '10.0.2.10', ttl: '00:20:00' },
        { name: 'web02', type: 'A', data: '10.0.2.11', ttl: '00:20:00' },
        { name: 'sql01', type: 'A', data: '10.0.3.10', ttl: '00:20:00' },
        { name: 'mail', type: 'A', data: '10.0.4.10', ttl: '00:20:00' },
        { name: 'vpn', type: 'A', data: '10.0.5.1', ttl: '00:20:00' },
        { name: '@', type: 'MX', data: '10 mail.contoso.local', ttl: '01:00:00' },
        { name: '@', type: 'MX', data: '20 mail-backup.contoso.local', ttl: '01:00:00' },
        { name: '@', type: 'TXT', data: 'v=spf1 mx a:mail.contoso.local -all', ttl: '01:00:00' },
        { name: 'www', type: 'CNAME', data: 'web01.contoso.local', ttl: '00:20:00' },
        { name: 'intranet', type: 'CNAME', data: 'web02.contoso.local', ttl: '00:20:00' },
        { name: '_ldap._tcp', type: 'SRV', data: '0 100 389 dc01.contoso.local', ttl: '00:10:00' },
        { name: '_kerberos._tcp', type: 'SRV', data: '0 100 88 dc01.contoso.local', ttl: '00:10:00' }
      ]
    },
    {
      name: '1.0.10.in-addr.arpa', type: 'Primary', is_reverse_lookup: true, is_ad_integrated: true,
      dynamic_update: 'Secure', aging_enabled: false, record_count: 3,
      records: [
        { name: '10', type: 'PTR', data: 'dc01.contoso.local', ttl: '00:20:00' },
        { name: '11', type: 'PTR', data: 'dc02.contoso.local', ttl: '00:20:00' },
        { name: '@', type: 'SOA', data: 'dc01.contoso.local admin.contoso.local', ttl: '01:00:00' }
      ]
    },
    {
      name: '2.0.10.in-addr.arpa', type: 'Primary', is_reverse_lookup: true, is_ad_integrated: true,
      dynamic_update: 'Secure', aging_enabled: false, record_count: 2,
      records: [
        { name: '10', type: 'PTR', data: 'web01.contoso.local', ttl: '00:20:00' },
        { name: '11', type: 'PTR', data: 'web02.contoso.local', ttl: '00:20:00' }
      ]
    },
    {
      name: 'contoso.com', type: 'Primary', is_reverse_lookup: false, is_ad_integrated: false,
      dynamic_update: 'None', aging_enabled: false, record_count: 8,
      records: [
        { name: '@', type: 'SOA', data: 'ns1.contoso.com admin.contoso.com', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'ns1.contoso.com', ttl: '01:00:00' },
        { name: '@', type: 'A', data: '203.0.113.10', ttl: '01:00:00' },
        { name: 'www', type: 'CNAME', data: 'cdn.contoso.com', ttl: '00:05:00' },
        { name: 'cdn', type: 'A', data: '203.0.113.20', ttl: '00:05:00' },
        { name: '@', type: 'MX', data: '10 mail.contoso.com', ttl: '01:00:00' },
        { name: '@', type: 'TXT', data: 'v=spf1 include:_spf.contoso.com -all', ttl: '01:00:00' },
        { name: '_dmarc', type: 'TXT', data: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@contoso.com', ttl: '01:00:00' }
      ]
    }
  ],
  FABRIKAM: [
    {
      name: 'fabrikam.local', type: 'Primary', is_reverse_lookup: false, is_ad_integrated: true,
      dynamic_update: 'Secure', aging_enabled: true, record_count: 12,
      records: [
        { name: '@', type: 'SOA', data: 'dc01.fabrikam.local admin.fabrikam.local', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'dc01.fabrikam.local', ttl: '01:00:00' },
        { name: 'dc01', type: 'A', data: '172.16.1.10', ttl: '00:20:00' },
        { name: 'app01', type: 'A', data: '172.16.2.10', ttl: '00:20:00' },
        { name: 'app02', type: 'A', data: '172.16.2.11', ttl: '00:20:00' },
        { name: 'db01', type: 'A', data: '172.16.3.10', ttl: '00:20:00' },
        { name: 'fs01', type: 'A', data: '172.16.4.10', ttl: '00:20:00' },
        { name: 'print01', type: 'A', data: '172.16.4.20', ttl: '00:20:00' },
        { name: 'portal', type: 'CNAME', data: 'app01.fabrikam.local', ttl: '00:20:00' },
        { name: 'api', type: 'CNAME', data: 'app02.fabrikam.local', ttl: '00:20:00' },
        { name: '_ldap._tcp', type: 'SRV', data: '0 100 389 dc01.fabrikam.local', ttl: '00:10:00' },
        { name: '@', type: 'MX', data: '10 mail.fabrikam.local', ttl: '01:00:00' }
      ]
    },
    {
      name: '16.172.in-addr.arpa', type: 'Primary', is_reverse_lookup: true, is_ad_integrated: true,
      dynamic_update: 'Secure', aging_enabled: false, record_count: 2,
      records: [
        { name: '10.1', type: 'PTR', data: 'dc01.fabrikam.local', ttl: '00:20:00' },
        { name: '10.2', type: 'PTR', data: 'app01.fabrikam.local', ttl: '00:20:00' }
      ]
    }
  ],
  NORTHWIND: [
    {
      name: 'northwind.local', type: 'Primary', is_reverse_lookup: false, is_ad_integrated: true,
      dynamic_update: 'NonsecureAndSecure', aging_enabled: false, record_count: 9,
      records: [
        { name: '@', type: 'SOA', data: 'dc01.northwind.local admin.northwind.local', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'dc01.northwind.local', ttl: '01:00:00' },
        { name: 'dc01', type: 'A', data: '192.168.1.10', ttl: '00:20:00' },
        { name: 'erp01', type: 'A', data: '192.168.2.10', ttl: '00:20:00' },
        { name: 'erp02', type: 'A', data: '192.168.2.11', ttl: '00:20:00' },
        { name: 'citrix01', type: 'A', data: '192.168.3.10', ttl: '00:20:00' },
        { name: 'remote', type: 'CNAME', data: 'citrix01.northwind.local', ttl: '00:20:00' },
        { name: '@', type: 'MX', data: '10 mail.northwind.local', ttl: '01:00:00' },
        { name: '@', type: 'TXT', data: 'v=spf1 mx -all', ttl: '01:00:00' }
      ]
    },
    {
      name: 'northwind.com', type: 'Secondary', is_reverse_lookup: false, is_ad_integrated: false,
      dynamic_update: 'None', aging_enabled: false, record_count: 4,
      records: [
        { name: '@', type: 'SOA', data: 'ns1.northwind.com admin.northwind.com', ttl: '01:00:00' },
        { name: '@', type: 'NS', data: 'ns1.northwind.com', ttl: '01:00:00' },
        { name: '@', type: 'A', data: '198.51.100.10', ttl: '01:00:00' },
        { name: 'www', type: 'A', data: '198.51.100.10', ttl: '00:05:00' }
      ]
    }
  ]
};

for (const [domain, zones] of Object.entries(dnsData)) {
  try {
    db.upsertDomainDNS(domain, zones);
    const totalRecords = zones.reduce((sum, z) => sum + (z.records ? z.records.length : 0), 0);
    console.log(`  [OK] ${domain} — ${zones.length} zones, ${totalRecords} records`);
  } catch (e) {
    console.error(`  [FAIL] ${domain}: ${e.message}`);
  }
}
console.log('DNS data seeding complete.');
