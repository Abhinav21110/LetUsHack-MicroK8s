# LetUsHack

## Getting Started

Follow these steps to set up and run the project locally.

### 1. Install Dependencies

First, install the required Node.js packages.

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file by copying the example file. Then, fill in the necessary values, especially your PostgreSQL database credentials.

```bash
cp .env.example .env.local
# Open .env.local and add your database password, etc.
```

### 3. Initialize the Database

#### Note:

- If you already have a DB, please DELETE it and re-create it.

```bash
# Drop and recreate letushack_db
PGPASSWORD=your_pg_password psql -h localhost -U postgres -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'letushack_db';" \
  -c "DROP DATABASE IF EXISTS letushack_db;" \
  -c "CREATE DATABASE letushack_db;"
```

Run the script to create the necessary tables in your PostgreSQL database.

```bash
npm run init:db
node scripts/init-labs.js
node scripts/create-test-users.js
```

### 4. Build Lab Docker Images

You must build the Docker images for the XSS, CSRF, and Nmap labs manually.

```bash
# Build XSS lab image
docker build -t xss_lab Docker_labs/XSS_docker/

# Build CSRF lab image
docker build -t csrf_lab Docker_labs/CSRF_docker-main/

# Build Nmap lab image
docker build -t nmap_lab Docker_labs/Nmap_docker/

# Build OS/Pwnbox image (Debian with XFCE desktop and pentesting tools)
docker build -t os-container-single-port OS/
```

### 5. Start the Reverse Proxy (Traefik)

Start the Traefik container. This will also create a Docker network named `traefik-net` that is used to route traffic to the lab containers.

```bash
docker compose -f traefik/docker-compose.yml up -d
```

### 6. Run the Application

Now you can start the main Next.js application.

```bash
npm run dev
```

The application will be available at `http://localhost:3000`. You can log in using the credentials from the `test-users-credentials.txt` file.

---

### Other Useful Commands

- **Test Docker Setup**: Verifies your Docker connection.
  ```bash
  npm run test:docker
  ```
- **Clean Up Containers**: Stops and removes all running lab containers.
  ```bash
  npm run cleanup:containers
  ```

## Architecture Overview

### Recent Major Improvements (November 2024)

#### Unified Container Architecture

- **Problem Solved**: OS containers previously exposed host ports (e.g., localhost:7001) while lab containers used Traefik-only routing
- **Solution**: Unified all containers to use **Traefik-only routing** for consistency and security
- **Result**: Both lab and OS containers now follow identical networking patterns

#### Enhanced User Experience

- **Loading Buffers**: Added 6-second minimum loading screens for all container operations
- **Improved Feedback**: Enhanced loading messages show Traefik routing setup progress
- **Consistent Timing**: Standardized buffer times across start/stop/restart operations
- **Better UX**: Prevents user confusion from seemingly "instant" loads before routing is ready

#### Code Simplification

- **Removed Port Management**: Eliminated complex port allocation logic from OS containers
- **Clean Interfaces**: Simplified `OSContainerInfo` interface by removing `allocatedPort` field
- **Unified Logic**: Same container creation patterns for both labs and OS environments
- **Better Maintainability**: Reduced code complexity and potential error points

## Database Schema

The application uses a PostgreSQL database with the following tables:

**`users`** table: Stores user account information.

- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR, UNIQUE): The user's unique identifier.
- `password_hash` (VARCHAR): Hashed password for authentication.
- `name` (VARCHAR): The user's display name.
- `created_at` (TIMESTAMP): Timestamp of account creation.

**`labs`** table: Defines the available labs/challenges.

- `id` (SERIAL PRIMARY KEY): Unique identifier for the lab.
- `name` (VARCHAR): The name of the lab (e.g., "Cross-Site Scripting").
- `description` (TEXT): A brief description of the lab.
- `difficulty` (VARCHAR): The difficulty level (e.g., "Easy", "Medium").
- `category` (VARCHAR): The category of the lab (e.g., "XSS", "CSRF").

**`lab_scores`** table: Tracks user progress and scores for each lab level.

- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY → users.username): The user who solved the level.
- `lab_id` (INTEGER, FOREIGN KEY → labs.id): The lab the score belongs to.
- `level` (INTEGER): The specific level within the lab.
- `score` (INTEGER): The points awarded for completing the level.
- `solved` (BOOLEAN): A flag indicating if the level has been completed.
- `created_at` (TIMESTAMP): Timestamp of when the level was solved.

**`notifications`** table: Stores notifications for users.

- `id` (SERIAL PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY → users.username): The recipient of the notification.
- `message` (TEXT): The content of the notification.
- `is_read` (BOOLEAN): A flag indicating if the notification has been read.
- `created_at` (TIMESTAMP): Timestamp of when the notification was created.

**`active_containers`** table: Tracks active Docker containers for user labs.

- `container_id` (VARCHAR, PRIMARY KEY): The unique ID of the Docker container.
- `user_id` (VARCHAR): The user who owns the container.
- `lab_type` (VARCHAR): The type of lab (e.g., "xss", "csrf", "nmap").
- `port` (INTEGER): The host port mapped to the container.
- `status` (VARCHAR): The current status of the container (e.g., "running").
- `created_at` (TIMESTAMP): Timestamp of when the container was created.

**`active_os_containers`** table: Tracks active OS/Pwnbox containers for users.

- `container_id` (VARCHAR, PRIMARY KEY): The unique ID of the Docker container.
- `user_id` (VARCHAR): The user who owns the OS container.
- `os_type` (VARCHAR): The type of OS environment (e.g., "debian").
- `status` (VARCHAR): The current status of the container (e.g., "running").
- `created_at` (TIMESTAMP): Timestamp of when the container was created.

## Container Architecture

### Unified Traefik Routing

All containers (both labs and OS environments) use **Traefik-only routing** for consistent access patterns:

**Lab Containers:**

- **Access Pattern**: `http://localhost/{username}/{lab-type}/`
- **Examples**:
  - `http://localhost/alice-johnson/xss/`
  - `http://localhost/john-doe/csrf/`
  - `http://localhost/test-user/nmap/`

**OS Containers (Pwnbox):**

- **Desktop Access**: `http://localhost/{username}/os/debian/vnc.html`
- **Direct Access**: `http://localhost/{username}/os/debian/`
- **Auto-login**: Credentials are `debian:debian`

### Network Architecture

- **Traefik Network**: `traefik-net` (172.20.0.0/16)
- **Gateway IP**: `172.20.0.1` (accessible from within containers)
- **No Host Port Exposure**: All containers route through Traefik only
- **Path-based Routing**: Containers distinguished by URL paths, not ports
- **Security**: No direct localhost port access, everything proxied through Traefik

### Loading Experience

All container operations include **6-second minimum loading buffers**:

- **Purpose**: Ensures Traefik routing is fully configured before user access
- **Operations**: Start, stop, restart for both lab and OS containers
- **User Feedback**: Loading messages show "Setting up Traefik routing" progress
- **Consistency**: Unified experience across all container types

## Docker Labs Setup

### Overview

_The system uses Dockerode to manage Docker containers for security challenge labs. Each user can have only one active lab container and one active OS/Pwnbox container at a time. Containers are automatically managed through the web interface._

### Features

- **Single Container Rule**: _Each user can only have one active lab container and one active OS container at any given time._
- **Automatic Container Management**: _Containers are automatically started, stopped, and cleaned up when the user interacts with the appropriate UI elements._
- **Lab Isolation**: _XSS, CSRF, and Nmap labs run in separate, isolated Docker containers_
- **Pwnbox Environment**: _Users can launch a Debian XFCE desktop environment with pre-installed penetration testing tools (nmap, curl, netcat, etc.) accessible via noVNC web interface._
- **Unified Routing**: _All containers (labs and OS) use Traefik-only routing with no host port exposure for consistent security._
- **URL Management**: _Container instances use path-based routing:_ `http://localhost/{username}/{type}/` _Usernames with spaces are converted to hyphens._
- **Persistent Tracking**: _Container state is tracked in the database (`active_containers` and `active_os_containers` tables)._
- **Enhanced UX**: _6-second minimum loading buffers ensure Traefik routing is ready before user access._
- **Traefik Reverse Proxy**: _All traffic routed through Traefik on the `traefik-net` network for security and consistency._

## API Endpoints

### Lab Container Management

#### Start Lab Container

```http
POST /api/labs/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "labType": "xss" | "csrf" | "nmap"
}
```

#### Stop Lab Container

```http
POST /api/labs/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "containerId": "optional-container-id"
}
```

#### Get Container Status

```
GET /api/labs/status
Authorization: Bearer <token>
```

### OS/Pwnbox Container Management

#### Start OS Container

```http
POST /api/os/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "osType": "debian"
}
```

#### Stop OS Container

```http
POST /api/os/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "containerId": "<container-id>"
}
```

#### Restart OS Container

```http
POST /api/os/restart
Authorization: Bearer <token>
Content-Type: application/json

{
  "containerId": "<container-id>"
}
```

#### Get OS Container Status

```
GET /api/os/status
Authorization: Bearer <token>
```

### Flag Validation (Nmap Challenge)

#### Validate Flag

```http
POST /api/labs/validate-flag
Authorization: Bearer <token>
Content-Type: application/json

{
  "labId": 3,
  "difficulty": "easy" | "medium" | "hard",
  "flag": "THM{...}",
  "containerId": "<container-id>"
}
```

Response includes points earned (33/33/34), total score, and completion status.

## Troubleshooting

### Test Local Auth

```bash
# register
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"roll_number":"r1","password":"pass1234","name":"John Doe"}'

# login
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"roll_number":"r1","password":"pass1234"}'
```

### Debugging Commands

```bash
# Test Docker connection and build images
npm run test:docker

# Test all API endpoints
npm run test:api

# Test container fixes and architecture
npm run test:fixes

# View active containers
docker ps

# View lab containers specifically
docker ps --filter "label=com.docker.compose.project=letushack-labs"

# View OS/Pwnbox containers
docker ps --filter "name=os_debian_"

# Clean up everything
npm run cleanup:containers

# View Docker logs for specific container
docker logs <container-id>

# Check Traefik network and routing
docker network inspect traefik-net
docker logs traefik

# Inspect Traefik routing rules
curl http://localhost:8080/api/http/routers
curl http://localhost:8080/api/http/services

# Test Traefik gateway accessibility from container
docker run --rm --network traefik-net alpine:latest ping -c 3 172.20.0.1
```

### Architecture Verification

After recent improvements, verify the unified architecture:

```bash
# 1. Ensure no containers expose host ports
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "(xss|csrf|nmap|os_debian)"
# Should show only internal port mappings, no host bindings like "0.0.0.0:7001->6080/tcp"

# 2. Verify Traefik routing
docker exec traefik traefik api --entrypoints | grep "PathPrefix"
# Should show path-based routing rules for all containers

# 3. Test container access patterns
# Labs: http://localhost/{username}/{labtype}/
# OS: http://localhost/{username}/os/debian/vnc.html

# 4. Verify 6-second loading buffers in browser DevTools Network tab
```

### Nmap Challenge Details

The Nmap challenge teaches reconnaissance and enumeration techniques:

**Lab Structure:**

- Users launch both the Nmap lab container and a Pwnbox (OS container)
- The Pwnbox provides a full Debian desktop with penetration testing tools
- Students use reconnaissance to discover and enumerate the FoodNow web application

**Reconnaissance Steps:**

1. Discover gateway IP: `route -n`
2. Port scan: `nmap -p 80,443,8080 172.20.0.1`
3. Enumerate paths: `curl http://172.20.0.1/{username}/nmap/`
4. Find hidden flags in `/uploads/` and `/api/` directories

**Flag System:**

- **Easy Flag** (33 points): Directory enumeration - `/uploads/flag_easy.txt`
- **Medium Flag** (33 points): API discovery - `/api/config.json`
- **Hard Flag** (34 points): Advanced enumeration - `/uploads/flag_hard.txt`
- **Total**: 100 points

**Features:**

- Progress tracker shows `X/100` points
- Flags lock after successful submission (no duplicate points)
- Real-time score updates
- Completion celebration at 100 points

### Leaderboard Feature

The leaderboard dynamically ranks users based on their total score:

- **Total Score** = sum of all 10 point columns (xl1-5 + cl1-5)
- Sorted by score (DESC), then by name (ASC)
- Highlights top 3 users with gold, silver, bronze styling
- Shows current user's rank and position
- Auto-refreshes on page load

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

 
 