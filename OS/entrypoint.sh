#!/usr/bin/env bash
set -e

USERNAME=${USERNAME:-debian}
VNC_PASS=${VNC_PASSWORD:-debian}

# Ensure locale (small but useful)
if ! locale -a | grep -q en_US.utf8; then
  echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
  locale-gen
fi

# Set VNC password for the user using vncpasswd (tigervnc-tools)
mkdir -p /home/${USERNAME}/.vnc
if command -v vncpasswd >/dev/null 2>&1; then
  # create a temp file with encrypted password using -f
  su - ${USERNAME} -c "printf '%s' '${VNC_PASS}' | vncpasswd -f > ~/.vnc/passwd"
else
  echo "vncpasswd not found; ensure tigervnc-tools is installed" >&2
  exit 1
fi
chown ${USERNAME}:${USERNAME} /home/${USERNAME}/.vnc/passwd
chmod 600 /home/${USERNAME}/.vnc/passwd

# ensure ownership
chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}

# Test nginx configuration
nginx -t

# --- Linux Fundamentals flags (unique per container) ---
# Generate three per-container flags in discoverable locations
# Easy: ~/lf_easy.txt, Medium: /opt/lf/lf_medium.txt, Hard: /var/tmp/.lf_hard.txt
(
  set +e
  gen_rand() {
    # 24 random alnum chars
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 || echo RAND${RANDOM}
  }

  EASY_FLAG="LXF{EASY-$(gen_rand)}"
  MED_FLAG="LXF{MEDIUM-$(gen_rand)}"
  HARD_FLAG="LXF{HARD-$(gen_rand)}"

  # Ensure directories
  mkdir -p /home/${USERNAME} /opt/lf /var/tmp

  echo "$EASY_FLAG" > /home/${USERNAME}/lf_easy.txt
  echo "$MED_FLAG" > /opt/lf/lf_medium.txt
  echo "$HARD_FLAG" > /var/tmp/.lf_hard.txt

  chown ${USERNAME}:${USERNAME} /home/${USERNAME}/lf_easy.txt || true
  chmod 0644 /home/${USERNAME}/lf_easy.txt /opt/lf/lf_medium.txt /var/tmp/.lf_hard.txt || true

  # Provide a central answers folder with symlinks for validation/debug
  mkdir -p /opt/answers
  ln -sf /home/${USERNAME}/lf_easy.txt /opt/answers/easy.txt
  ln -sf /opt/lf/lf_medium.txt /opt/answers/medium.txt
  ln -sf /var/tmp/.lf_hard.txt /opt/answers/hard.txt

  # Create README with hints for flag discovery
  cat >/home/${USERNAME}/README.txt <<'README'
===========================================
LINUX FUNDAMENTALS - FLAG HUNT CHALLENGE
===========================================

Welcome! Your mission is to find 3 hidden flags in this system.

HINTS:
------
🟢 EASY FLAG (33 pts):
   - Location: Your current home directory
   - Look for files with "lf" and "easy" in the name
   - Command: ls -la ~ | grep -i easy

🟡 MEDIUM FLAG (33 pts):
   - Location: System directories under /opt
   - Look for a dedicated folder with "lf" in its name
   - Command: find /opt -name "*lf*" 2>/dev/null

🔴 HARD FLAG (34 pts):
   - Location: Temporary directories
   - This file is HIDDEN (starts with a dot)
   - Command: find /var -name ".*lf*" 2>/dev/null

All flags follow the format: LXF{LEVEL-xxxxxxxxxxxxx}

BASIC COMMANDS:
---------------
pwd              # print working directory
ls -la           # list files including hidden ones
cat <file>       # show file contents
find / -name pattern 2>/dev/null   # find files by name
grep -i text file                  # search for text

Good luck, hacker!
===========================================
README

  chown ${USERNAME}:${USERNAME} /home/${USERNAME}/README.txt
  chmod 644 /home/${USERNAME}/README.txt
) &>/dev/null &

# Start supervisord (this will start vnc, websockify, and nginx)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
