// Client-side authentication utilities
// Since auth cookies are httpOnly, we need to make API calls with credentials

interface AuthenticatedFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function authenticatedFetch(url: string, options: AuthenticatedFetchOptions = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: 'include', // Include cookies in the request
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  return fetch(url, defaultOptions);
}

export async function checkAuthStatus(): Promise<{ authenticated: boolean; user: any }> {
  try {
    const res = await authenticatedFetch('/api/auth/check');
    if (!res.ok) {
      return { authenticated: false, user: null };
    }
    return await res.json();
  } catch (error) {
    console.error('Auth check failed:', error);
    return { authenticated: false, user: null };
  }
}

// Docker lab API calls
export async function startLabContainer(labType: 'xss' | 'csrf' | 'nmap') {
  try {
    const res = await authenticatedFetch('/api/labs/start', {
      method: 'POST',
      body: JSON.stringify({ labType }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to start lab container:', error);
    throw error;
  }
}

export async function stopLabContainer(podName: string, namespace: string) {
  try {
    const res = await authenticatedFetch('/api/labs/stop', {
      method: 'POST',
      body: JSON.stringify({ podName, namespace }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to stop lab container:', error);
    throw error;
  }
}

export async function getContainerStatus() {
  try {
    const res = await authenticatedFetch('/api/labs/status');

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to get container status:', error);
    throw error;
  }
}
