# THDC Hostel Attendance Management System

A full-stack enterprise web application for managing hostel residents, room allocations, biometric attendance, leave records, defaulter alerts, and administrative reports. It provides role-based dashboards for students, wardens, caretakers, and directors.

## Architecture

- **Backend:** Laravel 11 / Node.js Express (Dual compatibility)
- **Frontend:** React 19, TypeScript, Inertia.js, Tailwind CSS
- **Databases:**
  - **MySQL (Port 3306):** Central relational ledger for students, room allotments, leaves, and attendance records
  - **MongoDB (Port 27017):** Real-time biometric device SDK data (`biometric_db` -> `glog_data`, `user_info_result`, `get_user_id`, `command_request_pending`)
- **Biometric Machine:** S362 standalone biometric device (`RSS20241199684`)

## Features

- Role-based dashboards for students, wardens, chief warden, director, and biometric/caretaker operators.
- Student registration, live biometric enrollment verification, hostel and room management.
- Daily attendance records with present, late, approved leave, and absent/defaulter statuses.
- Real-time biometric punch matching directly with physical machine.
- Biometric device and punch-log workflows, including duplicate and unrecognized punch handling.
- Leave recording with date ranges, gate-pass generation, and parent consent tracking.
- Defaulter tracking, warning tickets, and tiered notification escalation.
- Attendance reports, hostel trends, scheduled-job history, system health, and security audit views.
- Simulated IST cutoff rules: on-time cutoff at 7:00 PM and defaulter evaluation at 9:00 PM / 10:00 PM.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, and Recharts/UI components.
- Backend: Laravel 11 / PHP 8.2+ with MySQL & MongoDB drivers; legacy Node.js Express fallback.

## Demo accounts

Use these accounts on the login page:

| Role | Email | Password |
|---|---|---|
| Student | `rahul.sharma@student.edu.in` | `student123` |
| Residential Warden (BH1) | `rw.shivalik@university.edu.in` | `rw123` |
| Warden (Girls Hostel) | `warden.mandakini@university.edu.in` | `warden123` |
| Warden (BH2) | `rw.nilgiri@university.edu.in` | `pathak123` |
| Chief Warden | `chiefwarden@university.edu.in` | `chief123` |
| Director | `director@university.edu.in` | `director123` |
| Biometric Device Manager (Mehra Ji) | `mehra@university.edu.in` | `mehra123` |
| Caretaker (BH1) | `caretaker.bh1@university.edu.in` | `caretaker123` |
| Caretaker (GH) | `caretaker.gh@university.edu.in` | `caretaker123` |
| Caretaker (BH2) | `caretaker.bh2@university.edu.in` | `caretaker123` |

## Available commands

| Command | Description |
|---|---|
| `php artisan serve --port=8000` | Start the Laravel backend API server at port 8000 |
| `npm run dev` | Start Vite asset bundler |
| `npm run build` | Build frontend assets for production into `public/build` |
