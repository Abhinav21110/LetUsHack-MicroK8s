// Simulated local API using localStorage as a simple database

interface CredentialRecord {
  email: string;
  password: string;
  timestamp: number;
}

class LocalAPI {
  // Obfuscated storage keys to make discovery harder
  private static DB_KEY = "app_session_meta_v2";
  private static BACKUP_KEY = "user_prefs_cache";

  // Simulate POST request to store credentials in obfuscated format
  static async storeCredentials(email: string, password: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const record = {
          u: btoa(email), // base64 encoded
          p: btoa(password), // base64 encoded
          ts: Date.now(),
          meta: "session_data"
        };
        
        localStorage.setItem(this.DB_KEY, JSON.stringify(record));
        localStorage.setItem(this.BACKUP_KEY, JSON.stringify({ ref: this.DB_KEY }));
        
        // Don't log credentials directly, just simulate network activity
        console.log(`[Network] POST /api/user/profile/update - 200 OK`);
        resolve();
      }, 100);
    });
  }

  // Simulate GET request to retrieve credentials
  static async getCredentials(): Promise<CredentialRecord | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const data = localStorage.getItem(this.DB_KEY);
        if (data) {
          const userData = JSON.parse(data);
          console.log(`[Network] GET /api/session/verify - 200 OK`);
          
          const record: CredentialRecord = {
            email: atob(userData.u),
            password: atob(userData.p),
            timestamp: userData.ts
          };
          resolve(record);
        } else {
          console.log(`[Network] GET /api/session/verify - 404 Not Found`);
          resolve(null);
        }
      }, 50);
    });
  }

  // Clear the database
  static clearDatabase(): void {
    localStorage.removeItem(this.DB_KEY);
    localStorage.removeItem(this.BACKUP_KEY);
  }
}

export default LocalAPI;
