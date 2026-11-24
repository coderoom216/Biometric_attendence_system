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
- Leave recording with gate-pass generation and parent consent tracking.
- Defaulter tracking, warning tickets, and tiered notification escalation.
