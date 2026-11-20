# THDC Hostel Attendance Management System

A full-stack web application for managing hostel residents, room allocations, biometric attendance, leave records, defaulter alerts, and administrative reports. It provides role-based dashboards for students and hostel staff.

> **Project status:** This repository currently runs with sample data held in server memory. It does not yet connect to a persistent database. Changes made during a run are lost when the server restarts. The included accounts and data are for demonstration only.

## Features

- Role-based dashboards for students, wardens, chief warden, director, and biometric/caretaker operators.
- Student registration, verification, hostel and room management.
- Daily attendance records with present, late, approved leave, and absent/defaulter statuses.
- Biometric device and punch-log workflows, including duplicate and unrecognized punch handling.
- Leave recording with date ranges, gate-pass information, and parent-consent tracking.
- Defaulter tracking, warning tickets, and tiered notification logs.
- Attendance reports, hostel trends, scheduled-job history, system health, and security audit views.
- Simulated IST cutoff rules: on-time cutoff at 7:00 PM and defaulter evaluation at 9:00 PM.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, and Recharts/UI components.
- Backend: Node.js, Express, and TypeScript (`tsx`).
- Current storage: in-memory sample data in `server/data/seed.ts` and `server/data/store.ts`.

## Requirements

- Node.js LTS (use a current LTS release compatible with the installed Vite version).
- npm, included with Node.js.
- Git is only needed if you are cloning the repository.

## Run locally

Open a terminal in the project folder and run:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The `dev` script starts the Express server and serves the Vite application.

To stop the server, press `Ctrl+C` in the terminal.

### Kali Linux first-time setup

If Node.js and npm are not installed, install Node.js LTS first. One option is to use Node Version Manager (NVM):

```bash
sudo apt update
sudo apt install -y curl git build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close and reopen the terminal, then run:

```bash
nvm install --lts
npm install
npm run dev
```

## Demo accounts

Use these accounts on the login page. They are seeded test credentials and must not be used for a real deployment.

| Role | Email | Password |
|---|---|---|
| Student | `rahul.sharma@student.edu.in` | `student123` |
| Residential Warden (BH1) | `rw.shivalik@university.edu.in` | `rw123` |
| Warden (Girls Hostel) | `warden.mandakini@university.edu.in` | `warden123` |
| Warden (BH2) | `rw.nilgiri@university.edu.in` | `pathak123` |
| Chief Warden | `chiefwarden@university.edu.in` | `chief123` |
| Director | `director@university.edu.in` | `director123` |
| Caretaker / Biometric Operator | `vmehra@university.edu.in` | `mehra123` |

## Available commands

| Command | Description |
|---|---|
| `npm run dev` | Start the full-stack development server at port 3000 |
| `npm run build` | Build the frontend for production into `dist/` |
| `npm run preview` | Preview the Vite production build |
| `npm run start` | Start the server (development mode unless `NODE_ENV=production`) |
| `npm run lint` | Run the TypeScript compiler without emitting files |

## API health check

The backend exposes a health endpoint at:

```text
GET http://localhost:3000/api/health
```

It reports the service status and configured attendance cutoff times.

## Project structure

```text
src/
  components/       Shared layout and dashboard components
  contexts/         Authentication context
  dashboards/       Dashboards by user role
  pages/            Application pages
  services/         Frontend API client
  types/            Frontend TypeScript types
server/
  data/             In-memory store and sample seed data
  middleware/       Authentication middleware
  routes/           Express API routes
  types.ts          Server data model types
server.ts           Express and Vite development server entry point
DATABASE_LAYOUT.md  Proposed relational database design
```

## Data and security notes

- The backend uses a process-local in-memory store. It is intended for demonstration and development, not durable record keeping.
- `server/data/seed.ts` contains demonstration accounts and student/attendance data. The passwords are plain demo values in the seed and are not suitable for production.
- Before deployment, connect a persistent database, use securely hashed passwords, configure secrets outside source control, and review access controls and personal-data handling.
- Biometric, notification, and scheduler flows are represented by application records and simulation logic; configure and validate real external services/devices before relying on them.

## Database design document

See [DATABASE_LAYOUT.md](DATABASE_LAYOUT.md) for the proposed tables, relationships, and attendance rules for a future persistent database.
