/* AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
   REASON: Temporarily disabling remote auth for local testing.
   ROLLBACK_INSTRUCTIONS:
     - Remove surrounding comment markers.
     - Restore env vars: SUPABASE_URL, SUPABASE_ANON_KEY, STACK_PROJECT_ID (if needed).
     - Re-enable any provider wrappers in _app or server middleware.
   Files changed:
     - src/stack/server.tsx (commented out StackServerApp)
   END_ROLLBACK */

// AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
// ROLLBACK_INSTRUCTIONS:
//  - To restore: remove the surrounding comment markers, re-enable env vars (SUPABASE_URL, SUPABASE_KEY, STACK_PROJECT_ID, etc.), and restore middleware ordering. Example:
//    // restore: uncomment import { StackServerApp } from '@stackframe/stack'
//  - If database connection variable names changed, revert them to original names.
// END_ROLLBACK

// import "server-only";
// import { StackServerApp } from "@stackframe/stack";
// export const stackServerApp = new StackServerApp({
//   tokenStore: "nextjs-cookie",
//   projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
//   publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
//   secretServerKey: process.env.STACK_SECRET_SERVER_KEY!,
// });
