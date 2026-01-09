#!/bin/sh
set -e

echo "🚩 Generating random flags for this container instance..."

# Generate random flags using Node.js with crypto (more secure than Math.random)
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function generateCryptoHexFlag(prefix, length = 16) {
  const randomHex = crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .substring(0, length);
  return \`THM{\${prefix}_\${randomHex}}\`;
}

const publicDir = '/usr/share/nginx/html';

// Generate cryptographically secure random flags
const easyFlag = generateCryptoHexFlag('EASY_FLAG_DIRECTORY_ENUM_SUCCESS', 12);
const mediumFlag = generateCryptoHexFlag('MEDIUM_FLAG_NONSTANDARD_PORT_DISCOVERED', 14);
const hardFlag = generateCryptoHexFlag('HARD_FLAG_MULTISERVICE_ARCHITECTURE_ENUMERATED', 16);

console.log('Generated Easy Flag:', easyFlag);
console.log('Generated Medium Flag:', mediumFlag);
console.log('Generated Hard Flag:', hardFlag);

// Write flags to files
fs.writeFileSync(path.join(publicDir, 'uploads', 'flag_easy.txt'), easyFlag);
fs.writeFileSync(path.join(publicDir, 'api', 'flag_medium.txt'), mediumFlag);
fs.writeFileSync(path.join(publicDir, 'uploads', 'flag_hard.txt'), hardFlag);

// Update the API config with the new medium flag
const configPath = path.join(publicDir, 'api', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.internal.flag_medium = mediumFlag;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// Update the .listing file
const listingPath = path.join(publicDir, 'uploads', '.listing');
const listingContent = \`# Directory listing - discovered via nmap --script http-enum
flag_easy.txt
flag_hard.txt
# Use nmap --script http-backup-finder for more files\`;
fs.writeFileSync(listingPath, listingContent);

console.log('✅ Flags generated and written successfully!');
"

echo "✅ Random flags generated successfully!"

# Replace the placeholder in config.js with the actual environment variable
if [ -f /usr/share/nginx/html/config.js ] && [ -n "$VITE_MAIN_WEB_URL" ]; then
  echo "Injecting VITE_MAIN_WEB_URL=$VITE_MAIN_WEB_URL into config.js"
  sed -i "s|VITE_MAIN_WEB_URL_PLACEHOLDER|$VITE_MAIN_WEB_URL|g" /usr/share/nginx/html/config.js
else
  echo "Warning: config.js not found or VITE_MAIN_WEB_URL not set"
fi

echo "🚀 Starting nginx..."

# Execute the original nginx command
exec "$@"
