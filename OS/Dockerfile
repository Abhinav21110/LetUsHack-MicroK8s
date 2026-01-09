# Debian + Xfce + TigerVNC + noVNC (Single-Port Architecture)
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    VNC_PASSWORD=debian \
    USERNAME=debian

# Install desktop, VNC, noVNC deps, nginx, supervisor, utilities, Firefox, and security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    xfce4 xfce4-session xfce4-terminal \
    tigervnc-standalone-server tigervnc-common tigervnc-tools \
    dbus-x11 x11-xserver-utils \
    python3 python3-pip git wget ca-certificates \
    supervisor sudo procps locales curl net-tools vim \
    nginx \
    firefox-esr \
    nmap \
    netcat-traditional \
    telnet \
    dnsutils \
    iputils-ping \
    traceroute \
    whois \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Clone noVNC and websockify
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone --depth 1 https://github.com/novnc/websockify.git /opt/noVNC/utils/websockify \
    && pip3 install --break-system-packages websockify

# Create a non-root user
RUN useradd -m -s /bin/bash ${USERNAME} && echo "${USERNAME} ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/${USERNAME}

# Setup VNC xstartup to start xfce
RUN mkdir -p /home/${USERNAME}/.vnc && \
    echo '#!/bin/bash' > /home/${USERNAME}/.vnc/xstartup && \
    echo 'unset SESSION_MANAGER' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'unset DBUS_SESSION_BUS_ADDRESS' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'export XKL_XMODMAP_DISABLE=1' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'export XDG_CURRENT_DESKTOP="XFCE"' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'export XDG_SESSION_DESKTOP="xfce"' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'export DESKTOP_SESSION="xfce"' >> /home/${USERNAME}/.vnc/xstartup && \
    echo '[ -x /etc/vnc/xstartup ] && exec /etc/vnc/xstartup' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'xrdb $HOME/.Xresources 2>/dev/null || true' >> /home/${USERNAME}/.vnc/xstartup && \
    echo '/usr/bin/startxfce4 &' >> /home/${USERNAME}/.vnc/xstartup && \
    echo 'wait' >> /home/${USERNAME}/.vnc/xstartup && \
    chmod +x /home/${USERNAME}/.vnc/xstartup && \
    chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}/.vnc

# Create desktop shortcuts and setup tools
RUN mkdir -p /home/${USERNAME}/Desktop && \
    mkdir -p /home/${USERNAME}/Tools && \
    # Create Firefox desktop shortcut
    echo '[Desktop Entry]' > /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Version=1.0' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Name=Firefox Web Browser' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Comment=Browse the World Wide Web' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'GenericName=Web Browser' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Keywords=Internet;WWW;Browser;Web;Explorer' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Exec=firefox %u' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Terminal=false' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'X-MultipleArgs=false' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Type=Application' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Icon=firefox' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    echo 'Categories=GNOME;GTK;Network;WebBrowser;' >> /home/${USERNAME}/Desktop/Firefox.desktop && \
    chmod +x /home/${USERNAME}/Desktop/Firefox.desktop && \
    # Create Nmap GUI desktop shortcut  
    echo '[Desktop Entry]' > /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Version=1.0' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Name=Terminal' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Comment=Use the command line' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'TryExec=xfce4-terminal' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Exec=xfce4-terminal' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Icon=utilities-terminal' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Type=Application' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    echo 'Categories=System;TerminalEmulator;' >> /home/${USERNAME}/Desktop/Terminal.desktop && \
    chmod +x /home/${USERNAME}/Desktop/Terminal.desktop && \
    # Create nmap examples script
    echo '#!/bin/bash' > /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo '# Nmap Examples and Common Commands' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "=== Nmap Examples and Common Commands ==="' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "1. Basic port scan:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "2. Scan specific ports:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -p 80,443,22 <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "3. Service detection:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -sV <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "4. OS detection:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -O <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "5. Aggressive scan:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -A <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "6. Stealth scan:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -sS <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "7. UDP scan:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -sU <target_ip>"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "8. Network discovery:"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "   nmap -sn 192.168.1.0/24"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    echo 'echo "Type: nmap --help for more options"' >> /home/${USERNAME}/Tools/nmap_examples.sh && \
    chmod +x /home/${USERNAME}/Tools/nmap_examples.sh && \
    # Create networking tools script
    echo '#!/bin/bash' > /home/${USERNAME}/Tools/networking_tools.sh && \
    echo '# Networking and Security Tools Available' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "=== Available Networking and Security Tools ==="' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "🌐 NETWORK SCANNING:"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • nmap - Network mapper for port scanning and service discovery"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "🌍 WEB BROWSING:"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • firefox - Web browser for web application testing"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "🔗 NETWORK UTILITIES:"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • netcat (nc) - Network Swiss Army knife for TCP/UDP connections"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • telnet - Connect to remote services"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • ping - Test network connectivity"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • traceroute - Trace network path to destination"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • wget/curl - Download files and make HTTP requests"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "🔍 DNS TOOLS:"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • nslookup - DNS lookup utility"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • dig - DNS lookup tool with more features"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  • whois - Domain registration information lookup"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "💡 QUICK START:"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  Run ./nmap_examples.sh to see Nmap usage examples"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo "  Open Firefox from the desktop or run: firefox"' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/networking_tools.sh && \
    chmod +x /home/${USERNAME}/Tools/networking_tools.sh && \
    # Create a welcome script
    echo '#!/bin/bash' > /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "=================================="' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "Welcome to the Security Lab Environment"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "=================================="' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "This environment includes:"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "• Firefox Web Browser"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "• Nmap Network Scanner"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "• Various networking utilities"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "Available scripts in ~/Tools/:"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "• ./nmap_examples.sh - Nmap usage examples"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "• ./networking_tools.sh - List of available tools"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo "Desktop shortcuts available for Firefox and Terminal"' >> /home/${USERNAME}/Tools/welcome.sh && \
    echo 'echo ""' >> /home/${USERNAME}/Tools/welcome.sh && \
    chmod +x /home/${USERNAME}/Tools/welcome.sh && \
    # Add welcome message to .bashrc
    echo '' >> /home/${USERNAME}/.bashrc && \
    echo '# Display welcome message for new terminals' >> /home/${USERNAME}/.bashrc && \
    echo 'if [ -f ~/Tools/welcome.sh ]; then' >> /home/${USERNAME}/.bashrc && \
    echo '    ~/Tools/welcome.sh' >> /home/${USERNAME}/.bashrc && \
    echo 'fi' >> /home/${USERNAME}/.bashrc && \
    # Set ownershiphttp://localhost:9001/
    chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}/Desktop && \
    chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}/Tools

# Configure nginx to serve noVNC on port 80
RUN rm /etc/nginx/sites-enabled/default && \
    echo 'server {' > /etc/nginx/sites-available/novnc && \
    echo '    listen 80 default_server;' >> /etc/nginx/sites-available/novnc && \
    echo '    listen [::]:80 default_server;' >> /etc/nginx/sites-available/novnc && \
    echo '    server_name _;' >> /etc/nginx/sites-available/novnc && \
    echo '    root /opt/noVNC;' >> /etc/nginx/sites-available/novnc && \
    echo '    index vnc.html;' >> /etc/nginx/sites-available/novnc && \
    echo '' >> /etc/nginx/sites-available/novnc && \
    echo '    location / {' >> /etc/nginx/sites-available/novnc && \
    echo '        try_files $uri $uri/ /vnc.html;' >> /etc/nginx/sites-available/novnc && \
    echo '    }' >> /etc/nginx/sites-available/novnc && \
    echo '' >> /etc/nginx/sites-available/novnc && \
    echo '    location /websockify {' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_pass http://localhost:6080/;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/sites-available/novnc && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/sites-available/novnc && \
    echo '    }' >> /etc/nginx/sites-available/novnc && \
    echo '}' >> /etc/nginx/sites-available/novnc && \
    ln -s /etc/nginx/sites-available/novnc /etc/nginx/sites-enabled/novnc

# Supervisord config and entrypoint
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh

EXPOSE 80

USER root
CMD ["/entrypoint.sh"]
