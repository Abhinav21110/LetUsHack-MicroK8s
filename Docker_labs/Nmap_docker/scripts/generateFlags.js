import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate randomized hexadecimal flags
 */
function generateHexFlag(prefix, length = 16) {
  const hexChars = '0123456789abcdef';
  let randomHex = '';
  
  for (let i = 0; i < length; i++) {
    randomHex += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  
  return `THM{${prefix}_${randomHex}}`;
}

/**
 * Generate all flags and write them to files
 */
function generateFlags() {
  const publicDir = path.join(path.dirname(__dirname), 'public');
  
  // Generate randomized flags
  const easyFlag = generateHexFlag('EASY_FLAG_DIRECTORY_ENUM_SUCCESS', 12);
  const mediumFlag = generateHexFlag('MEDIUM_FLAG_NONSTANDARD_PORT_DISCOVERED', 14);
  const hardFlag = generateHexFlag('HARD_FLAG_MULTISERVICE_ARCHITECTURE_ENUMERATED', 16);
  
  // Write flags to files
  fs.writeFileSync(path.join(publicDir, 'uploads', 'flag_easy.txt'), easyFlag);
  fs.writeFileSync(path.join(publicDir, 'api', 'flag_medium.txt'), mediumFlag);
  fs.writeFileSync(path.join(publicDir, 'uploads', 'flag_hard.txt'), hardFlag);
  
  // Update the API config with the new medium flag
  const configPath = path.join(publicDir, 'api', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.internal.flag_medium = mediumFlag;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  // Update the .listing file with current files
  const listingPath = path.join(publicDir, 'uploads', '.listing');
  const listingContent = `# Directory listing - discovered via nmap --script http-enum
flag_easy.txt
flag_hard.txt
# Use nmap --script http-backup-finder for more files`;
  fs.writeFileSync(listingPath, listingContent);
  
  console.log('🚩 Generated new randomized flags successfully!');
  // Flags are now ready for CTF challenges
}

// Run flag generation
generateFlags();