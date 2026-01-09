# OS Container - Nmap Exercise Environment

## Build Commands

### Build the Docker Image
```bash
docker build -t os-container-single-port .
```

### Run the Container
```bash
docker run -d \
  --name letushack-pwnbox \
  -p 6080:6080 \
  -p 5900:5900 \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  os-container-single-port
```

### View Container Logs
```bash
docker logs letushack-pwnbox
```

### Stop Container
```bash
docker stop letushack-pwnbox
docker rm letushack-pwnbox
```