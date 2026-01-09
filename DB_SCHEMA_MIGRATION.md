# Database Schema Migration Documentation

This document details all database schema changes required for migrating features from `basic-website-main` to `tigera-new`.

## Migration Date
January 9, 2026

## Overview
This migration adds support for:
1. Admin Panel functionality with role-based access control
2. K8s (Kubernetes) lab tracking
3. Lab settings and system configuration
4. Audit logging for administrative actions

---

## New Tables

### 1. `active_k8s_labs`
**Purpose**: Track active Kubernetes lab pods for users

```sql
CREATE TABLE IF NOT EXISTS active_k8s_labs (
  pod_name VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  lab_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_k8s_labs_user_id ON active_k8s_labs(user_id);
CREATE INDEX IF NOT EXISTS idx_k8s_labs_namespace ON active_k8s_labs(namespace);
```

**Columns**:
- `pod_name`: Unique identifier for the Kubernetes pod (PRIMARY KEY)
- `namespace`: Kubernetes namespace where the pod is running
- `user_id`: ID of the user who owns this lab instance
- `lab_type`: Type/name of the lab (e.g., 'xss', 'csrf', 'nmap')
- `status`: Current status (running, stopped, failed, etc.)
- `url`: Access URL for the lab instance
- `created_at`: Timestamp when the lab was created
- `updated_at`: Timestamp of last update

---

### 2. `active_k8s_os_containers`
**Purpose**: Track active Kubernetes OS container pods (Ubuntu, Kali, etc.)

```sql
CREATE TABLE IF NOT EXISTS active_k8s_os_containers (
  pod_name VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  os_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  url TEXT,
  vnc_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_k8s_os_user_id ON active_k8s_os_containers(user_id);
CREATE INDEX IF NOT EXISTS idx_k8s_os_namespace ON active_k8s_os_containers(namespace);
```

**Columns**:
- `pod_name`: Unique identifier for the Kubernetes pod (PRIMARY KEY)
- `namespace`: Kubernetes namespace where the pod is running
- `user_id`: ID of the user who owns this container
- `os_type`: Type of OS (ubuntu, kali, parrot, etc.)
- `status`: Current status (running, stopped, failed, etc.)
- `url`: Access URL for terminal/SSH access
- `vnc_url`: VNC access URL for graphical interface
- `created_at`: Timestamp when container was created
- `updated_at`: Timestamp of last update

---

### 3. `lab_settings`
**Purpose**: Control individual lab availability and configuration

```sql
CREATE TABLE IF NOT EXISTS lab_settings (
    id SERIAL PRIMARY KEY,
    lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    max_concurrent_users INTEGER DEFAULT 100,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    UNIQUE(lab_id)
);
```

**Columns**:
- `id`: Auto-incrementing primary key
- `lab_id`: Reference to labs table (FOREIGN KEY)
- `is_enabled`: Whether lab is available to users
- `max_concurrent_users`: Maximum simultaneous users allowed
- `description`: Admin notes about the lab
- `updated_at`: Timestamp of last update
- `updated_by`: User ID of admin who made the change

---

### 4. `system_settings`
**Purpose**: Store global system configuration parameters

```sql
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Default Values**:
```sql
INSERT INTO system_settings (key, value, description) VALUES
    ('max_labs_per_user', '3', 'Maximum number of concurrent labs per user'),
    ('max_os_per_user', '1', 'Maximum number of concurrent OS containers per user'),
    ('lab_timeout_minutes', '60', 'Auto-stop labs after this many minutes'),
    ('maintenance_mode', 'false', 'Enable maintenance mode')
ON CONFLICT (key) DO NOTHING;
```

**Columns**:
- `key`: Unique setting identifier (PRIMARY KEY)
- `value`: Setting value (stored as text, parse as needed)
- `description`: Human-readable description
- `updated_at`: Timestamp of last update

---

### 5. `audit_log`
**Purpose**: Track all administrative actions for security and compliance

```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    admin_user_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
```

**Columns**:
- `id`: Auto-incrementing primary key
- `admin_user_id`: User ID of the admin who performed the action
- `action`: Action performed (e.g., 'toggle_lab', 'update_role')
- `target_type`: Type of resource affected (user, lab, setting)
- `target_id`: ID of the affected resource
- `details`: JSON object with additional action details
- `ip_address`: IP address of the admin
- `created_at`: Timestamp of the action

---

## Modified Tables

### `users` Table
**Modification**: Add role column for admin functionality

```sql
-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student';

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

**New Column**:
- `role`: User role (values: 'student', 'admin', 'instructor')
  - Default: 'student'
  - Used for access control to admin panel

---

## Existing Tables (No Changes Required)

The following tables remain unchanged and are reused:

### `users`
- Core user information
- Uses same column names: `user_id`, `password_hash`, `name`, etc.

### `labs`
- Lab definitions
- Uses same column names: `lab_id`, `lab_name`, `lab_description`, etc.

### `lab_scores`
- User lab progress
- Uses same structure

### `notifications`
- User notifications
- No changes needed

---

## Migration Steps

1. **Run K8s Tables Script**:
   ```bash
   psql -U postgres -d letushack_db -f scripts/init-k8s-tables.sql
   ```

2. **Run Admin Tables Script**:
   ```bash
   psql -U postgres -d letushack_db -f scripts/add-admin-tables.sql
   ```

3. **Update init-db.js** to include K8s tables on fresh installations

4. **Verify Migration**:
   ```bash
   npm run init:db
   ```

---

## Data Relationships

```
users
  ├── role (NEW COLUMN)
  ├── active_k8s_labs (via user_id)
  ├── active_k8s_os_containers (via user_id)
  └── audit_log (via admin_user_id)

labs
  └── lab_settings (via lab_id)

system_settings
  └── (standalone configuration)

audit_log
  └── (audit trail, references users)
```

---

## Security Considerations

1. **Role Column**: Defaults to 'student' to ensure least privilege
2. **Audit Log**: All admin actions are logged with IP addresses
3. **Lab Settings**: Cascade deletes ensure orphaned settings are cleaned up
4. **Indexes**: Added for performance on frequently queried columns

---

## Rollback Procedures

If migration needs to be rolled back:

```sql
-- Drop new tables
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS lab_settings;
DROP TABLE IF EXISTS active_k8s_os_containers;
DROP TABLE IF EXISTS active_k8s_labs;

-- Remove role column (optional)
ALTER TABLE users DROP COLUMN IF EXISTS role;
```

---

## Notes

- All `user_id` columns are VARCHAR(255) to match existing users table
- Timestamps use `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` for consistency
- Foreign keys include `ON DELETE CASCADE` where appropriate
- All indexes follow naming convention: `idx_<table>_<column>`
- JSONB is used in audit_log for flexible detail storage

## Environment Variables

No new environment variables are required. The same database connection settings are used:
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE` (default: `letushack_db`)
