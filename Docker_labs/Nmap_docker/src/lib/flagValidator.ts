// Flag validation utilities for HTB clone integration

export interface FlagSubmission {
  challenge: string;
  flag: string;
  timestamp: number;
}

export interface FlagValidationResponse {
  correct: boolean;
  message?: string;
  points?: number;
}

/**
 * Validate a submitted flag against the parent HTB platform
 * The parent platform should expose an API endpoint that accepts flag submissions
 * and returns whether the flag is correct
 */
export async function validateFlag(submission: FlagSubmission): Promise<FlagValidationResponse> {
  try {
    // Get the parent platform API URL from environment or window config
    const apiUrl = (window as any).HTB_API_URL || '/api/validate-flag';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include any authentication tokens if required
        'Authorization': `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Flag validation error:', error);
    throw error;
  }
}

/**
 * Get session token for HTB platform authentication
 * The parent platform should inject this token when embedding the challenge
 */
function getSessionToken(): string {
  // Check for token in various locations
  const token = 
    (window as any).HTB_SESSION_TOKEN ||
    sessionStorage.getItem('htb_session_token') ||
    localStorage.getItem('htb_session_token') ||
    '';
  
  return token;
}

/**
 * Generate a dynamic flag format that the HTB platform can validate
 * Format: HTB{<instance_id>_<challenge_id>_<random_suffix>}
 */
export function generateFlagFormat(instanceId: string, challengeId: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `HTB{${instanceId}_${challengeId}_${randomSuffix}}`;
}

/**
 * Notify parent HTB platform of challenge events
 */
export function notifyParentPlatform(event: string, data: any) {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'htb_challenge_event',
      event,
      data,
      timestamp: Date.now(),
    }, '*');
  }
}
