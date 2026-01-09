-- K8s Labs Tracking Table
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

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_k8s_labs_user_id ON active_k8s_labs(user_id);
CREATE INDEX IF NOT EXISTS idx_k8s_labs_namespace ON active_k8s_labs(namespace);

-- K8s OS Containers Tracking Table
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

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_k8s_os_user_id ON active_k8s_os_containers(user_id);
CREATE INDEX IF NOT EXISTS idx_k8s_os_namespace ON active_k8s_os_containers(namespace);
