-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student';

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing admin user (change 'admin-user' to your actual admin username)
-- UPDATE users SET role = 'admin' WHERE user_id = 'admin-user';

-- Create lab_settings table for enabling/disabling labs
CREATE TABLE IF NOT EXISTS lab_settings (
    id SERIAL PRIMARY KEY,
    lab_id INTEGER REFERENCES labs(lab_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    max_concurrent_users INTEGER DEFAULT 100,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    UNIQUE(lab_id)
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
    ('max_labs_per_user', '3', 'Maximum number of concurrent labs per user'),
    ('max_os_per_user', '1', 'Maximum number of concurrent OS containers per user'),
    ('lab_timeout_minutes', '60', 'Auto-stop labs after this many minutes'),
    ('maintenance_mode', 'false', 'Enable maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- Create audit_log table for tracking admin actions
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

COMMENT ON TABLE lab_settings IS 'Controls for enabling/disabling individual labs';
COMMENT ON TABLE system_settings IS 'Global system configuration';
COMMENT ON TABLE audit_log IS 'Tracks all administrative actions';
