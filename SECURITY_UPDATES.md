# Security Updates & Setup Guide

## 🔒 Overview

This document outlines critical security enhancements implemented in the Letushack platform and provides setup instructions for development and production environments.

---

## 📋 Table of Contents

- [Security Changes Summary](#security-changes-summary)
- [New Files Added](#new-files-added)
- [Modified Files](#modified-files)
- [Environment Setup](#environment-setup)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Development Setup](#development-setup)
- [Testing Security Features](#testing-security-features)
- [Troubleshooting](#troubleshooting)

---

## 🛡️ Security Changes Summary

### 1. JWT Secret Validation
**File:** `src/lib/auth.ts`

- **Before:** Used weak default secret `'dev-secret-change-me'` with no validation
- **After:** 
  - Enforces minimum 32-character length
  - Prevents default secret in production
  - Application fails to start if misconfigured in production
  - Clear warnings in development

### 2. Hybrid Rate Limiting
**File:** `src/app/api/login/route.ts`

- **Before:** Only IP-based limiting (5 attempts per IP)
- **After:**
  - **IP-based:** 20 attempts per 15 minutes (protects infrastructure)
  - **User-based:** 5 attempts per 15 minutes per account (protects individual accounts)
  - Prevents both brute force and account spraying attacks

### 3. Secure Encryption
**File:** `src/lib/encryption.ts`

- **Before:** Used insecure MD5 + AES-CBC with deterministic IV
- **After:**
  - AES-256-GCM with authenticated encryption
  - Random IV for each encryption
  - scrypt for key derivation
  - Authentication tags to detect tampering

### 4. Environment Variable Validation
**Files:** `src/lib/env-validator.ts`, `src/lib/db.ts`

- **Before:** No validation, runtime failures possible
- **After:**
  - Validates all critical environment variables on startup
  - Application fails immediately in production if vars missing
  - Clear warnings in development

### 5. Error Message Sanitization
**Files:** `src/app/api/login/route.ts`, `src/app/api/leaderboard/route.ts`, `src/app/api/lab-scores/update/route.ts`

- **Before:** Exposed stack traces and database details to clients
- **After:**
  - Generic error messages in production
  - Detailed errors only in development
  - Structured server-side logging

---

## 📁 New Files Added

### 1. `src/lib/env-validator.ts` (114 lines)
**Purpose:** Centralized environment variable validation

**Validates:**
- Database credentials (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
- JWT secret (minimum 32 characters)
- Application URLs (HOST_URL, LAB_ORIGIN_URL)

**Usage:**
```typescript
import { ensureValidEnvironment } from '@/lib/env-validator';
ensureValidEnvironment(); // Call at app startup
```

### 2. `src/lib/rate-limiter.ts` (150 lines)
**Purpose:** Reusable rate limiting utility

**Pre-configured Limiters:**
```typescript
import { RateLimiters } from '@/lib/rate-limiter';

RateLimiters.login(req);        // 5 attempts / 15 min
RateLimiters.register(req);     // 3 attempts / 1 hour
RateLimiters.labStart(req);     // 10 attempts / 1 hour
RateLimiters.scoreUpdate(req);  // 20 attempts / 1 min
RateLimiters.api(req);          // 60 requests / 1 min
```

---

## 🔧 Modified Files

| File | Lines Changed | Key Changes |
|------|---------------|-------------|
| `src/lib/auth.ts` | +31, -3 | JWT secret validation |
| `src/lib/encryption.ts` | +110, -29 | Secure AES-256-GCM encryption |
| `src/lib/db.ts` | +8 | Database env validation |
| `src/app/api/login/route.ts` | +121, -29 | Hybrid rate limiting + error sanitization |
| `src/app/api/leaderboard/route.ts` | +13, -3 | Error sanitization |
| `src/app/api/lab-scores/update/route.ts` | +14, -7 | Error sanitization |

---

## 🔑 Environment Setup

### Required Environment Variables

Create `.env.local` file in the project root:

```bash
# ============================================
# DATABASE CONFIGURATION (REQUIRED)
# ============================================
PGHOST=localhost                    # Database host
PGPORT=5432                        # Database port
PGUSER=postgres                    # Database username
PGPASSWORD=your_secure_password    # Database password
PGDATABASE=letushack_db            # Database name

# ============================================
# JWT AUTHENTICATION (REQUIRED)
# ============================================
# MUST be minimum 32 characters in production
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET_LOCAL=your-super-secret-jwt-key-minimum-32-characters-long

# ============================================
# APPLICATION URLS (REQUIRED)
# ============================================
HOST_URL=http://localhost:3000     # Main application URL
LAB_ORIGIN_URL=http://localhost    # Lab container base URL

# ============================================
# OPTIONAL CONFIGURATION
# ============================================
ENCRYPTION_SALT=your-unique-encryption-salt-for-aes-gcm
TRAEFIK_NETWORK=traefik-net
NODE_ENV=development               # or 'production'
```

### Generating Secure Secrets

#### JWT Secret (64 characters recommended):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Encryption Salt (64 characters recommended):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Production Deployment Checklist

### 1. Environment Variables
- [ ] Set `NODE_ENV=production`
- [ ] Set `JWT_SECRET_LOCAL` with minimum 32 characters (64+ recommended)
- [ ] Set all database credentials (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`)
- [ ] Set `HOST_URL` to your production domain (e.g., `https://letushack.com`)
- [ ] Set `LAB_ORIGIN_URL` to your lab domain
- [ ] Set `ENCRYPTION_SALT` for secure encryption

### 2. Security Validation
```bash
# Test that app fails with invalid JWT secret
JWT_SECRET_LOCAL="short" npm run build  # Should fail

# Test that app fails with missing database vars
unset PGPASSWORD && npm run build       # Should fail
```

### 3. Database Setup
```bash
# Initialize database
npm run init:db

# Seed labs data
node scripts/init-labs.js

# Create test users (development only)
node scripts/create-test-users.js
```

### 4. Docker Setup
```bash
# Build lab images
docker build -t xss_lab Docker_labs/XSS_docker/
docker build -t csrf_lab Docker_labs/CSRF_docker-main/

# Start Traefik reverse proxy
docker compose -f traefik/docker-compose.yml up -d
```

### 5. Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start
```

### 6. Post-Deployment Tests
- [ ] Test login rate limiting (5 failed attempts should block account)
- [ ] Test IP rate limiting (20 failed attempts from same IP should block)
- [ ] Verify error messages don't expose stack traces
- [ ] Confirm JWT tokens are being validated properly

---

## 💻 Development Setup

### First-Time Setup

1. **Clone Repository & Install Dependencies**
```bash
git clone <repository-url>
cd basic-website
npm install
```

2. **Create Environment File**
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. **Setup Database**
```bash
# Start PostgreSQL (via Docker or local installation)
docker-compose up -d db

# Initialize database
npm run init:db

# Seed lab data
node scripts/init-labs.js

# Create test users
node scripts/create-test-users.js
```

4. **Build Docker Lab Images**
```bash
docker build -t xss_lab Docker_labs/XSS_docker/
docker build -t csrf_lab Docker_labs/CSRF_docker-main/
```

5. **Start Traefik**
```bash
docker compose -f traefik/docker-compose.yml up -d
```

6. **Run Development Server**
```bash
npm run dev
```

7. **Access Application**
- Main app: http://localhost:3000
- Login with test credentials from `test-users-credentials.txt`

### Development Environment Variables

Minimum required for development:
```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_dev_password
PGDATABASE=letushack_db
JWT_SECRET_LOCAL=dev-secret-must-be-at-least-32-characters-long
HOST_URL=http://localhost:3000
LAB_ORIGIN_URL=http://localhost
```

---

## 🧪 Testing Security Features

### 1. Test JWT Secret Validation

**Test 1: Short secret should warn (dev) or fail (prod)**
```bash
# Development - should show warning but continue
JWT_SECRET_LOCAL="short" npm run dev

# Production - should fail immediately
NODE_ENV=production JWT_SECRET_LOCAL="short" npm start
```

**Test 2: Default secret in production should fail**
```bash
NODE_ENV=production JWT_SECRET_LOCAL="dev-secret-change-me" npm start
# Expected: Error thrown, app doesn't start
```

### 2. Test Hybrid Rate Limiting

**Test User-Based Limit (5 attempts per account):**
```bash
# Try logging in with wrong password 6 times for user "testuser"
for i in {1..6}; do 
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"user_id":"testuser","password":"wrongpassword"}' \
    -v
done

# 6th attempt should return:
# HTTP/1.1 429 Too Many Requests
# Message: "Too many failed login attempts for this account..."
```

**Test IP-Based Limit (20 attempts total):**
```bash
# Try 20+ login attempts from same IP on different accounts
for i in {1..25}; do 
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"user${i}\",\"password\":\"wrong\"}" \
    -v
done

# After 20 attempts, should return:
# HTTP/1.1 429 Too Many Requests
# Message: "Too many login attempts from this IP address..."
```

### 3. Test Error Sanitization

**Development Mode:**
```bash
# Should show detailed errors
NODE_ENV=development npm run dev
# Try triggering an error - should see stack trace in response
```

**Production Mode:**
```bash
# Should show generic errors
NODE_ENV=production npm start
# Try triggering an error - should see generic message only
```

### 4. Test Encryption

```typescript
// Test in Node.js console
import { encrypt, decrypt } from './src/lib/encryption';

const data = encrypt("secret message", "my-password");
console.log(data); // { encrypted, iv, authTag }

const decrypted = decrypt(data, "my-password");
console.log(decrypted); // "secret message"

// Should throw error with wrong key
decrypt(data, "wrong-password"); // Error: Decryption failed
```

---

## 🔍 Troubleshooting

### Problem: "JWT_SECRET_LOCAL must be set in production"

**Solution:**
```bash
# Set JWT secret with minimum 32 characters
export JWT_SECRET_LOCAL=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Problem: "Database environment variables must be set in production"

**Solution:**
```bash
# Ensure all database vars are set
export PGHOST=your-db-host
export PGUSER=your-db-user
export PGPASSWORD=your-db-password
export PGDATABASE=letushack_db
```

### Problem: Rate limiting not working

**Symptoms:** Can make unlimited login attempts

**Solution:**
- Check that you're testing from the same IP address
- Verify user_id is being sent correctly in request body
- Check server logs for `[LOGIN_USER_RATE_LIMITED]` or `[LOGIN_IP_RATE_LIMITED]`
- Clear rate limit maps by restarting server

### Problem: Encryption errors after update

**Symptoms:** "Decryption failed: Invalid key or corrupted data"

**Solution:**
- Old encrypted data uses CBC mode (incompatible with new GCM mode)
- Use legacy functions for old data:
  ```typescript
  import { decryptLegacy } from '@/lib/encryption';
  const decrypted = decryptLegacy(oldEncryptedString, key);
  ```
- For new encryption, always use the new `encrypt()` function

### Problem: TypeScript errors in IDE

**Symptoms:** "Cannot find module 'next/server'"

**Solution:**
```bash
# Ensure all types are installed
npm install --save-dev @types/node @types/react @types/react-dom

# Restart TypeScript server in VS Code
# Command Palette (Ctrl+Shift+P) -> "TypeScript: Restart TS Server"
```

---

## 📊 Rate Limiting Behavior Examples

### Scenario 1: Legitimate Office (Multiple Users, Same IP)

```
Office IP: 203.0.113.45

Employee Alice (user: alice):
  Attempt 1-3: Wrong password → ✅ Allowed
  Attempt 4: Correct → ✅ Success! (alice counter resets)

Employee Bob (user: bob):
  Attempt 1-2: Wrong password → ✅ Allowed
  Attempt 3: Correct → ✅ Success!

Employee Charlie (user: charlie):
  Attempt 1-5: Wrong password → ✅ Allowed
  Attempt 6: → ❌ BLOCKED (charlie account locked for 15 min)

Result: IP has 10/20 attempts used, all users can login independently
```

### Scenario 2: Brute Force Attack

```
Attacker IP: 198.51.100.23
Target: "admin" account

Attempt 1-5: Different passwords → ✅ Allowed but failed
Attempt 6: → ❌ BLOCKED!

Response:
  Status: 429 Too Many Requests
  Message: "Too many failed login attempts for this account"
  Retry-After: 900 (15 minutes)

Result: Account "admin" protected, even though IP has 15 attempts left
```

### Scenario 3: Account Spraying Attack

```
Attacker IP: 192.0.2.100
Trying common password on multiple accounts

user1 (5 attempts) + user2 (5 attempts) + user3 (5 attempts) + user4 (5 attempts)
= 20 total attempts used

Attempt 21 (any account): → ❌ BLOCKED!

Response:
  Status: 429 Too Many Requests
  Message: "Too many login attempts from this IP address"
  Retry-After: 900

Result: IP limit prevents unlimited account spraying
```

---

## 🔐 Security Best Practices

### For Developers

1. **Never commit `.env.local` or `.env.production` files**
   - Add to `.gitignore`
   - Use environment variable injection in CI/CD

2. **Rotate secrets regularly**
   - JWT secret every 90 days
   - Database passwords every 90 days

3. **Use strong passwords**
   - Minimum 12 characters
   - Mix uppercase, lowercase, numbers, symbols

4. **Monitor rate limiting logs**
   - Watch for `[LOGIN_USER_RATE_LIMITED]` (potential brute force)
   - Watch for `[LOGIN_IP_RATE_LIMITED]` (potential DDoS)

5. **Test in production-like environment**
   - Set `NODE_ENV=production` locally
   - Verify error messages are sanitized

### For System Administrators

1. **Use secrets management**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

2. **Enable HTTPS in production**
   - JWT cookies use `secure` flag when HTTPS detected
   - Prevents token interception

3. **Set up monitoring**
   - Alert on repeated 429 responses
   - Monitor failed login attempts
   - Track container creation/deletion

4. **Regular backups**
   - Database backups every 24 hours
   - Test restore procedures monthly

---

## 📞 Support & Questions

For security concerns or questions about these changes, contact:
- **Security Changes Applied:** Anirudh
- **Documentation:** This file + inline code comments

---

## 📅 Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2024-11-14 | 1.0.0 | Initial security hardening implementation |

---

## ✅ Quick Reference

**Minimum environment variables for production:**
```bash
PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
JWT_SECRET_LOCAL (32+ chars)
HOST_URL
NODE_ENV=production
```

**Rate limits:**
- IP-based: 20 attempts / 15 minutes
- User-based: 5 attempts / 15 minutes / account

**Required commands:**
```bash
npm install
npm run init:db
docker build -t xss_lab Docker_labs/XSS_docker/
docker build -t csrf_lab Docker_labs/CSRF_docker-main/
docker compose -f traefik/docker-compose.yml up -d
npm run dev  # or npm start for production
```

---

*Last Updated: November 14, 2024*
