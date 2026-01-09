"use client";

/* ROOT_ROUTE_CHANGED_TEMP
   ROLLBACK_INSTRUCTIONS: Move this page back to `/` and update header nav/link. */
/* AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
   REASON: Temporarily disabling remote auth for local testing.
   ROLLBACK_INSTRUCTIONS:
     - Restore Stack auth buttons and provider when re-enabling auth.
*/

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Letushack</h1>
        <p className="text-gray-600 mb-6">Auth temporarily disabled — guest mode enabled</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}


