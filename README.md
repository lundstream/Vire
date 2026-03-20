# Vire

**Vire** — from the Latin *vigilāte* (watch) and *reficite* (repair). A server inventory and monitoring dashboard that watches your Windows Server fleet and helps you keep it healthy.

## Features

### Dashboard & Monitoring
- **Real-time stats** — Total servers, online/offline status, reboot pending, missing updates, critical events, disk alerts, service issues
- **Heartbeat monitoring** — Lightweight agent reports CPU, RAM, disk, and service status every minute; servers not reporting within 3 minutes are flagged offline
- **Attention list** — Top 50 servers requiring attention, auto-sorted by severity (offline, missing updates, critical events, stopped services, disk space, AV issues)
- **Charts** — OS distribution, physical vs virtual, hypervisor breakdown, health overview, per-domain health breakdown

### Server Inventory
- **30+ data points per server** — OS, hardware, network, security, patching, services, and more
- **Server detail modal** — Deep-dive with tabbed sections: overview, network, disks, roles, services, local admins, missing updates, event errors, firewall rules, local policies, logbook
- **Disk space trends** — 30-day line charts per drive with color-coded thresholds
- **CPU/RAM snapshots** — Historical usage data over time

### Group Policy Management
- **Domain GPOs** — Collect and browse all Group Policy Objects across domains
- **Link & setting detail** — View targets, enforcement status, WMI filters, and individual policy settings
- **Per-server GPOs** — See which GPOs apply to each server

### Maintenance Mode
- **Per-server maintenance windows** — Set duration (30 min – 24 hours) with comment
- **Auto-expiration** — Maintenance clears automatically when the window ends
- **Attention suppression** — Servers in maintenance are excluded from the attention list
- **Script support** — Set maintenance from PowerShell before planned work

### Logbook
- **Per-server audit trail** — Timestamped comments with author tracking
- **Global logbook view** — Browse entries across all servers with domain, server, and search filters

### Access Control
- **Session-based auth** — bcrypt password hashing, 8-hour session timeout
- **API key auth** — SHA-256 hashed keys for PowerShell script authentication
- **Role-based access** — Admin (full access) and Viewer (restricted by domain)
- **Permission groups** — Map users to domains; viewers only see servers in their assigned domains
- **Admin panel** — Manage users, API keys, and permission groups from the web UI

### UI
- **Dark/Light theme** — Toggle with preference saved to localStorage
- **Paginated server list** — Sortable, searchable, filterable by domain
- **Responsive design** — Works on desktop and tablet

### Deployment
- **Docker support** — Ready-to-deploy with Docker/Docker Compose
- **IIS support** — Includes `web.config` for reverse proxy setups

## Architecture

```
┌─────────────────┐                               ┌──────────────┐
│  Windows Server │  POST /api/inventory (4h)      │              │
│  (Scheduled     │ ─────────────────────────────> │    Vire      │
│   Task / SYSTEM)│  POST /api/heartbeat (1 min)   │   (Node.js   │
│                 │ ─────────────────────────────> │    Express)  │
└─────────────────┘                               │              │
                                                  │              │
┌─────────────────┐                               │              │
│  Domain         │  POST /api/gpo                 │              │
│  Controller     │ ─────────────────────────────> │              │
└─────────────────┘                               │              │
                                                  │              │
┌─────────────────┐  GET /api/*                   │              │
│  Web Browser    │ <────────────────────────────> │              │
│  (Admin/Viewer) │  (Session auth)               │              │
└─────────────────┘                               └──────┬───────┘
                                                         │
                                                  ┌──────┴───────┐
                                                  │   SQLite DB  │
                                                  │ (inventory.db)│
                                                  └──────────────┘
```

## Quick Start

### 1. Install & Run

```bash
npm install
node server.js
```

Open http://localhost:3000. Default credentials:
- **Username:** `admin`
- **Password:** `ChangeMe123!`

> **Change the default password immediately** via Admin > Users.

### 2. Configure

Copy `settings.example.json` to `settings.json` and edit:

```json
{
  "siteName": "Vire",
  "server": { "port": 3000 },
  "session": { "secret": "your-random-secret-here" },
  "defaultAdminPassword": "ChangeMe123!"
}
```

### 3. Generate an API Key

1. Log in as admin
2. Open the **Admin** panel
3. Under **API Keys**, enter a name and click **Generate Key**
4. Copy the key (shown only once)

### 4. Deploy Collection Scripts

#### Full Inventory (every 4 hours)

Copy `scripts/Collect-ServerInventory.ps1` and `scripts/Install-ScheduledTask.ps1` to each server. Run as Administrator:

```powershell
.\Install-ScheduledTask.ps1 -ApiUrl "https://your-server:3000/api/inventory" -ApiKey "your-api-key"
```

This creates a Scheduled Task that runs as SYSTEM every 4 hours (configurable with `-IntervalHours`), collecting 30+ inventory data points.

#### Heartbeat (every 1 minute)

Copy `scripts/Send-Heartbeat.ps1` and `scripts/Install-HeartbeatTask.ps1` to each server. Run as Administrator:

```powershell
.\Install-HeartbeatTask.ps1 -ApiUrl "https://your-server:3000/api/heartbeat" -ApiKey "your-api-key"
```

This creates a lightweight task that reports CPU, RAM, disk, and service status every minute.

#### Domain GPOs (from a Domain Controller)

```powershell
.\Collect-DomainGPO.ps1 -ApiUrl "https://your-server:3000/api/gpo" -ApiKey "your-api-key"
```

#### Maintenance Mode (before planned work)

```powershell
.\Set-Maintenance.ps1 -ApiUrl "https://your-server:3000" -ApiKey "your-api-key" -Hours 4 -Comment "Patching"
```

### 5. Manual Test Run

```powershell
.\Collect-ServerInventory.ps1 -ApiUrl "http://localhost:3000/api/inventory" -ApiKey "your-api-key"
```

## Docker

```bash
docker-compose up -d
```

## Data Collected Per Server

### Identity
| Field | Description |
|-------|-------------|
| Hostname | Computer name |
| FQDN | Fully qualified domain name |
| IP Addresses | All NICs with adapter, IP, subnet, MAC, speed |
| AD / Workgroup | Domain or workgroup membership |
| OU | Organizational Unit (if domain-joined) |

### System
| Field | Description |
|-------|-------------|
| OS Edition/Version/Build | e.g., Windows Server 2022 Datacenter |
| Install Date | Original OS installation date |
| Last Boot Time | Last restart |
| Activation Status | Licensed/activated |
| Physical vs VM | Detection with hypervisor identification |
| CPU | Model, core count, current usage % |
| RAM | Total and used GB |
| Disk Layout | Volumes, size, free space, file system |

### Patching
| Field | Description |
|-------|-------------|
| Last Patch Date | Most recent hotfix install date |
| Missing Critical Updates | Count and details from Windows Update |
| WSUS Server | Patch source |
| Reboot Pending | Whether a restart is needed |

### Security
| Field | Description |
|-------|-------------|
| Antivirus/EDR | Product name and status |
| BitLocker | Encryption status |
| Local Admins | Members of Administrators group |
| RDP | Enabled/disabled with NLA status |
| Last Admin/User Login | Most recent interactive logons |
| Last Security Scan | Defender scan timestamp |
| Critical Events (24h) | Event log critical errors |
| Firewall Rules | All active rules with source tracking (GPO/Local) |
| AD GPOs | Applied Group Policy Objects |
| Local Policies | Security policy export |

### Infrastructure
| Field | Description |
|-------|-------------|
| Installed Roles/Features | AD DS, IIS, SQL Server, etc. |
| Running Services | Services with status and start type |
| Cluster Health | Failover cluster status |
| Replication Health | AD replication status |

## API Reference

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | None | Login with username/password |
| `/api/auth/logout` | POST | Session | End session |
| `/api/auth/me` | GET | Session | Current user info |

### Data Collection (API Key in `X-API-Key` header)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory` | POST | Full server inventory push |
| `/api/heartbeat` | POST | Lightweight health check (CPU, RAM, disk, services) |
| `/api/gpo` | POST | Domain GPO data push |
| `/api/maintenance` | POST | Set maintenance mode via script |

### Dashboard & Servers (requires login)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/stats` | GET | Dashboard statistics (supports `?domain=` filter) |
| `/api/servers` | GET | Paginated server list (`?page=`, `?limit=`, `?sort=`, `?dir=`, `?q=`, `?domain=`) |
| `/api/servers/search?q=` | GET | Quick search (up to 50 results) |
| `/api/servers/:hostname` | GET | Full server details with all child data |
| `/api/servers/:hostname/disk-history` | GET | Disk space trends (`?days=30`) |
| `/api/servers/:hostname/snapshots` | GET | CPU/RAM history (`?days=30`) |
| `/api/servers/:hostname` | DELETE | Delete server (admin only) |

### Logbook (requires login)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/logbook` | GET | All logbook entries (`?limit=`, `?domain=`) |
| `/api/servers/:hostname/logbook` | GET | Entries for a specific server |
| `/api/servers/:hostname/logbook` | POST | Add logbook entry |
| `/api/servers/:hostname/logbook/:id` | DELETE | Delete logbook entry |

### Maintenance (requires login)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/servers/:hostname/maintenance` | POST | Set maintenance mode (hours, comment) |
| `/api/servers/:hostname/maintenance` | DELETE | End maintenance (admin only) |

### Group Policy (requires login)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gpo` | GET | List domain GPOs (`?domain=` filter) |
| `/api/gpo/domains` | GET | List domains with GPO data |

### Admin (requires admin role)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET/POST | List/create users |
| `/api/admin/users/:id` | DELETE | Delete user |
| `/api/admin/users/:id/password` | POST | Reset password |
| `/api/admin/apikeys` | GET/POST | List/create API keys |
| `/api/admin/apikeys/:id` | DELETE | Revoke API key |
| `/api/admin/apikeys/:id/purge` | DELETE | Permanently delete revoked key |
| `/api/admin/groups` | GET/POST | List/create permission groups |
| `/api/admin/groups/:id` | PUT/DELETE | Update/delete group |
| `/api/admin/groups/:id/domains` | PUT | Set group domain access |
| `/api/admin/groups/:id/members` | POST | Add user to group |
| `/api/admin/groups/:id/members/:userId` | DELETE | Remove user from group |

## Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `Collect-ServerInventory.ps1` | Full inventory collection (30+ data points) | Every 4 hours |
| `Send-Heartbeat.ps1` | Lightweight health check (CPU, RAM, disk, services) | Every 1 minute |
| `Collect-DomainGPO.ps1` | Domain GPO collection (run on DC) | As needed |
| `Set-Maintenance.ps1` | Set maintenance mode before planned work | Manual |
| `Install-ScheduledTask.ps1` | Install inventory scheduled task | One-time |
| `Install-HeartbeatTask.ps1` | Install heartbeat scheduled task | One-time |

## Tech Stack

- **Backend:** Node.js, Express 5
- **Database:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js
- **Collection:** PowerShell 5.1+ (runs as SYSTEM)
- **Deployment:** Docker, IIS (web.config), or standalone
