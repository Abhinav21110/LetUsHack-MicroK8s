#!/bin/sh
set -e

# Replace the placeholder in config.js with the actual environment variable
if [ -f /usr/share/nginx/html/config.js ] && [ -n "$VITE_MAIN_WEB_URL" ]; then
  echo "Injecting VITE_MAIN_WEB_URL=$VITE_MAIN_WEB_URL into config.js"
  sed -i "s|VITE_MAIN_WEB_URL_PLACEHOLDER|$VITE_MAIN_WEB_URL|g" /usr/share/nginx/html/config.js
else
  echo "Warning: config.js not found or VITE_MAIN_WEB_URL not set"
fi

# Start nginx
exec nginx -g 'daemon off;'
