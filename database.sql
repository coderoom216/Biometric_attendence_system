CREATE DATABASE IF NOT EXISTS hostel_attendance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hostel_attendance_db;

CREATE TABLE IF NOT EXISTS hostels (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  type ENUM('boys', 'girls') NOT NULL,
  blocks JSON NOT NULL,
  total_floors INT UNSIGNED NOT NULL,
  total_rooms INT UNSIGNED NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  chief_warden VARCHAR(150) NOT NULL,
  residential_warden VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  hostel_id VARCHAR(64) NOT NULL,
  block VARCHAR(100) NOT NULL,
  floor INT NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  current_occupancy INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('available', 'full', 'maintenance') NOT NULL DEFAULT 'available',
  CONSTRAINT fk_rooms_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_room_location UNIQUE (hostel_id, block, room_number),
  INDEX idx_rooms_block_floor (hostel_id, block, floor)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(64) PRIMARY KEY,
  enrollment_no VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  course VARCHAR(120) NOT NULL,
  branch VARCHAR(150),
  year TINYINT UNSIGNED,
  semester TINYINT UNSIGNED NOT NULL,
  gender ENUM('male', 'female', 'other') NOT NULL,
  hostel_id VARCHAR(64) NOT NULL,
  block VARCHAR(100) NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  bed_number VARCHAR(20),
  biometric_id VARCHAR(100) NOT NULL UNIQUE,
  student_email VARCHAR(255) NOT NULL,
  student_phone VARCHAR(30) NOT NULL DEFAULT '',
  parent_name VARCHAR(150) NOT NULL DEFAULT '',
  parent_email VARCHAR(255) NOT NULL DEFAULT '',
  parent_phone VARCHAR(30) NOT NULL DEFAULT '',
  verification_status ENUM('verified', 'pending_verification', 'rejected') NOT NULL,
  verified_by VARCHAR(200),
  verified_at DATETIME,
  rejection_reason TEXT,
  allotment_date DATE NOT NULL,
  checkout_date DATETIME,
  checkout_status ENUM('active', 'vacated') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_students_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_students_room_location
    FOREIGN KEY (hostel_id, block, room_number)
    REFERENCES rooms(hostel_id, block, room_number)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_students_status_hostel (verification_status, checkout_status, hostel_id),
  INDEX idx_students_room (hostel_id, block, room_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM(
    'student',
    'residential_warden',
    'warden',
    'chief_warden',
    'director',
    'caretaker_operator'
  ) NOT NULL,
  phone VARCHAR(30),
  hostel_id VARCHAR(64),
  block_id VARCHAR(100),
  student_id VARCHAR(64),
  avatar_url VARCHAR(500),
  CONSTRAINT fk_users_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_users_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_users_role_hostel (role, hostel_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS biometric_devices (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  model VARCHAR(120),
  serial_number VARCHAR(120) UNIQUE,
  hostel_id VARCHAR(64) NOT NULL,
  location VARCHAR(180) NOT NULL,
  installation_date DATE,
  installed_by VARCHAR(150),
  installation_notes TEXT,
  total_logs_stored_locally INT UNSIGNED NOT NULL DEFAULT 0,
  last_sync_at DATETIME,
  status ENUM('online_synced', 'stale_pending_import', 'error') NOT NULL,
  authorized_technician VARCHAR(180) NOT NULL,
  CONSTRAINT fk_devices_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_devices_hostel_status (hostel_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(100) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  enrollment_no VARCHAR(50) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  hostel_id VARCHAR(64) NOT NULL,
  block VARCHAR(100) NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present', 'late', 'approved_leave', 'absent') NOT NULL,
  punch_time TIME,
  biometric_device_id VARCHAR(64),
  is_defaulter BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_at DATETIME,
  corrected_by VARCHAR(200),
  corrected_at DATETIME,
  correction_reason TEXT,
  remarks TEXT,
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_attendance_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_attendance_device
    FOREIGN KEY (biometric_device_id) REFERENCES biometric_devices(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT uq_attendance_student_date UNIQUE (student_id, attendance_date),
  INDEX idx_attendance_date_status (attendance_date, status),
  INDEX idx_attendance_hostel_date (hostel_id, attendance_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS biometric_punch_logs (
  id VARCHAR(100) PRIMARY KEY,
  biometric_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  punch_timestamp DATETIME NOT NULL,
  imported_at DATETIME NOT NULL,
  imported_by VARCHAR(180) NOT NULL,
  status ENUM('processed', 'duplicate_ignored', 'unrecognized_id') NOT NULL,
  CONSTRAINT fk_punch_logs_device_code
    FOREIGN KEY (device_id) REFERENCES biometric_devices(device_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_punch_logs_biometric_time (biometric_id, punch_timestamp),
  INDEX idx_punch_logs_device_time (device_id, punch_timestamp)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_records (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  enrollment_no VARCHAR(50) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  hostel_id VARCHAR(64) NOT NULL,
  block VARCHAR(100) NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  gate_pass_no VARCHAR(50) NOT NULL UNIQUE,
  parent_consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
  entered_by_residential_warden_id VARCHAR(64) NOT NULL,
  residential_warden_name VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL,
  notes TEXT,
  CONSTRAINT fk_leaves_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_leaves_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_leaves_entered_by
    FOREIGN KEY (entered_by_residential_warden_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_leaves_student_dates (student_id, start_date, end_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warning_tickets (
  id VARCHAR(100) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  enrollment_no VARCHAR(50) NOT NULL,
  hostel_id VARCHAR(64) NOT NULL,
  hostel_name VARCHAR(150) NOT NULL,
  block VARCHAR(100) NOT NULL,
  room_number VARCHAR(30) NOT NULL,
  course VARCHAR(120) NOT NULL,
  parent_name VARCHAR(150) NOT NULL,
  parent_phone VARCHAR(30) NOT NULL DEFAULT '',
  parent_email VARCHAR(255) NOT NULL DEFAULT '',
  late_punches_count INT UNSIGNED NOT NULL DEFAULT 0,
  missed_checkins_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_violations INT UNSIGNED NOT NULL DEFAULT 0,
  severity ENUM('strike_1', 'strike_2', 'flagged_for_admin_review') NOT NULL,
  status ENUM('active', 'under_review', 'resolved') NOT NULL,
  issued_at DATETIME NOT NULL,
  latest_violation_date DATE NOT NULL,
  reason TEXT NOT NULL,
  admin_notes TEXT,
  CONSTRAINT fk_tickets_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_tickets_hostel_status (hostel_id, status),
  INDEX idx_tickets_student (student_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_logs (
  id VARCHAR(100) PRIMARY KEY,
  notification_date DATE NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  enrollment_no VARCHAR(50) NOT NULL,
  hostel_id VARCHAR(64) NOT NULL,
  tier TINYINT UNSIGNED NOT NULL,
  recipient_role VARCHAR(60) NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('queued', 'sent', 'delivered', 'failed') NOT NULL,
  failure_reason TEXT,
  sent_at DATETIME NOT NULL,
  retry_count INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_notifications_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_hostel
    FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_notification_tier CHECK (tier BETWEEN 1 AND 6),
  INDEX idx_notifications_student_date (student_id, notification_date),
  INDEX idx_notifications_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scheduled_job_logs (
  id VARCHAR(100) PRIMARY KEY,
  job_name VARCHAR(150) NOT NULL,
  scheduled_time VARCHAR(40) NOT NULL,
  executed_at DATETIME NOT NULL,
  completed_at DATETIME NOT NULL,
  status ENUM('completed', 'failed', 'in_progress') NOT NULL,
  date_evaluated DATE NOT NULL,
  total_students INT UNSIGNED NOT NULL DEFAULT 0,
  present_count INT UNSIGNED NOT NULL DEFAULT 0,
  late_count INT UNSIGNED NOT NULL DEFAULT 0,
  leave_count INT UNSIGNED NOT NULL DEFAULT 0,
  defaulters_count INT UNSIGNED NOT NULL DEFAULT 0,
  notifications_queued INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT,
  INDEX idx_jobs_date_status (date_evaluated, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  logged_at DATETIME NOT NULL,
  action VARCHAR(100) NOT NULL,
  performed_by_user_id VARCHAR(64) NOT NULL,
  performed_by_user_name VARCHAR(150) NOT NULL,
  performed_by_user_role VARCHAR(60) NOT NULL,
  target_entity VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(45),
  INDEX idx_audit_actor_time (performed_by_user_id, logged_at),
  INDEX idx_audit_target (target_entity, target_id)
) ENGINE=InnoDB;

