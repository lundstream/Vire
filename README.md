# Vire

**Vire** — from the Latin *vigilāte* (watch) and *reficite* (repair). A server inventory and monitoring dashboard that watches your Windows Server fleet and helps you keep it healthy.

A comprehensive dashboard that collects and visualizes Windows Server health, security, and configuration data.

## Features

- **Secure Login** — Session-based authentication with bcrypt password hashing
- **API Key Authentication** — Servers POST inventory data using API keys
- **Comprehensive Data Collection** — 30+ data points per server including OS, hardware, security, patches, and more
- **Dashboard** — Real-time overview with charts showing OS distribution, health status, and attention items
- **Visualization Pages:**
  - Windows Firewall Rules (filterable by server, searchable)
  - AD Group Policies applied to each server
  - Local Security Policies
  - Disk Space Trends over time with charts
- **Server Detail Modal** — Deep-dive into any server with tabbed sections for network, disks, roles, services, admins, updates, and event logs
- **Dark/Light Theme** — User preference persisted in localStorage
- **Admin Panel** — Manage users and API keys from the web UI
- **Docker Support** — Ready-to-deploy with Docker/Docker Compose

## Architecture

```
┌─────────────────┐     POST /api/inventory      ┌──────────────┐
│  Windows Server │ ──────────────────────────>   │              │
│  (Scheduled     │     (API Key auth)            │  Inventory   │
│   Task / SYSTEM)│                               │  Web Server  │
└─────────────────┘                               │  (Node.js)   │
                                                  │              │
┌─────────────────┐     GET /api/*                │              │
│  Web Browser    │ <─────────────────────────>   │              │
│  (Admin/Viewer) │     (Session auth)            │              │
└─────────────────┘                               └──────┬───────┘
                                                         │
                                                  ┌──────┴───────┐
                                                  │   SQLite DB  │
                                                  │ (inventory.db)│
                                                  └──────────────┘
```

## Quick Start

### 1. Install & Run the Web Server

```bash
cd Inventory-web
npm install
node server.js
```

Open http://localhost:3000. Default credentials:
- **Username:** `admin`
- **Password:** `ChangeMe123!`

> **Change the default password immediately** via Admin > Users.

### 2. Configure

Edit `settings.json`:

```json
{
  "server": { "port": 3000 },
  "session": { "secret": "your-random-secret-here" },
  "defaultAdminPassword": "ChangeMe123!"
}
```

### 3. Generate an API Key

1. Log in as admin
2. Go to **Admin** tab
3. Under **API Keys**, enter a name and click **Generate Key**
4. Copy the key (shown only once)

### 4. Deploy the Collection Script

Copy `scripts/Collect-ServerInventory.ps1` and `scripts/Install-ScheduledTask.ps1` to each server.

Run as Administrator:

```powershell
.\Install-ScheduledTask.ps1 -ApiUrl "https://your-server:3000/api/inventory" -ApiKey "your-api-key"
```

This creates a Scheduled Task that:
- Runs as **SYSTEM** (read-only operations)
- Executes every **4 hours** (configurable with `-IntervalHours`)
- Collects 30+ inventory data points
- POSTs the data to the API with the API key

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
| RDP | Enabled or disabled |
| Last Admin/User Login | Most recent interactive logons |
| Last Security Scan | Defender scan timestamp |
| Critical Events (24h) | Event log critical errors |
| Firewall Rules | All active rules |
| AD GPOs | Applied Group Policy Objects |
| Local Policies | Security policy export |

### Infrastructure
| Field | Description |
|-------|-------------|
| Installed Roles/Features | AD DS, IIS, SQL Server, etc. |
| Running Services | Critical services with status |
| Cluster Health | Failover cluster status |
| Replication Health | AD replication status |

## API Reference

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | None | Login with username/password |
| `/api/auth/logout` | POST | Session | End session |
| `/api/auth/me` | GET | Session | Current user info |

### Inventory (POST)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/inventory` | POST | API Key | Submit server inventory data |

The API key is sent in the `X-API-Key` header.

### Data (GET — requires login)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/stats` | GET | Dashboard statistics |
| `/api/servers` | GET | List all servers |
| `/api/servers/search?q=` | GET | Search servers |
| `/api/servers/:hostname` | GET | Full server details |
| `/api/servers/:hostname/disk-history?days=30` | GET | Disk trends |
| `/api/servers/:hostname/snapshots?days=30` | GET | CPU/RAM history |

### Admin (requires admin role)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET/POST | List/create users |
| `/api/admin/users/:id` | DELETE | Delete user |
| `/api/admin/users/:id/password` | POST | Reset password |
| `/api/admin/apikeys` | GET/POST | List/create API keys |
| `/api/admin/apikeys/:id` | DELETE | Revoke API key |

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js
- **Collection:** PowerShell 5.1+ (runs as SYSTEM)
