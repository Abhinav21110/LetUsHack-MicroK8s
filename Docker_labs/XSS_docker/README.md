## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 1.29 or higher)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:3000`

### Option 2: Using Docker directly

```bash
# Build the image
docker build -t xss-security-lab .

# Run the container
docker run -d \
  --name xss-security-lab \
  -p 3000:80 \
  --restart unless-stopped \
  xss-security-lab

# View logs
docker logs -f xss-security-lab

# Stop and remove the container
docker stop xss-security-lab
docker rm xss-security-lab
```

## Available Exercises

1. **Stored DOM XSS** (`/simplexss`) - Guestbook with innerHTML vulnerability
2. **DOM-based XSS** (`/domxss`) - URL hash parameter injection
3. **Chained XSS** (`/level3`) - Multi-step vulnerability exploitation

## Docker Configuration

### Multi-stage Build

The Dockerfile uses a multi-stage build process:
- **Builder stage**: Node.js 20 Alpine for building the React application
- **Production stage**: Nginx Alpine for serving the static files

### Port Configuration

Default port mapping: `3000:80`

To use a different host port:
```bash
# Docker Compose: Edit docker-compose.yml
ports:
  - "8080:80"  # Use port 8080 instead

# Docker CLI
docker run -p 8080:80 xss-security-lab
```

### Health Check

The container includes a health check that runs every 30 seconds:
```bash
# Check container health
docker ps

# Manual health check
docker exec xss-security-lab wget --spider http://localhost/
```

## Development

For local development without Docker:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
.
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose configuration
├── nginx.conf             # Nginx server configuration
├── .dockerignore          # Files to exclude from Docker build
├── src/
│   ├── pages/
│   │   ├── Index.tsx          # Main landing page
│   │   ├── SimplexssPage.tsx  # Exercise 1
│   │   ├── DomxssPage.tsx     # Exercise 2
│   │   └── Level3Page.tsx     # Exercise 3
│   └── ...
└── ...
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Verify port availability
lsof -i :3000  # On macOS/Linux
netstat -ano | findstr :3000  # On Windows
```

### Build failures
```bash
# Clean build
docker-compose down -v
docker system prune -f
docker-compose build --no-cache
docker-compose up
```

### Permission issues
```bash
# On Linux, if you encounter permission issues
sudo chown -R $USER:$USER .
```
