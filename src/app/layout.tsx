// import type { Metadata } from "next";
// import { StackProvider, StackTheme } from "@stackframe/stack";
// import { stackClientApp } from "../stack/client";
// import { Space_Grotesk } from "next/font/google";

// const spaceGrotesk = Space_Grotesk({
//   variable: "--font-space-grotesk",
//   subsets: ["latin"],
//   display: "swap",
// });

// export const metadata: Metadata = {
//   title: "CyberLearn Dashboard",
//   description: "Hands-on cybersecurity challenges and learning platform",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en" className="dark">
//       <body
//         suppressHydrationWarning={true}
//         className={`${spaceGrotesk.variable} bg-background-dark font-display text-slate-200 antialiased`}
//       >
//         <StackProvider app={stackClientApp}>
//           <StackTheme>
//             {children}
//           </StackTheme>
//         </StackProvider>
//       </body>
//     </html>
//   );
// }
/* PROJECT_RENAME: cyberlearn -> Letushack (temporary)
   ROLLBACK_INSTRUCTIONS: Revert package.json name and any renamed references. */
/* AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
   REASON: Temporarily disabling remote auth for local testing.
   ROLLBACK_INSTRUCTIONS:
     - Remove surrounding comment markers around StackProvider/StackTheme and stackClientApp usage.
     - Restore env vars: SUPABASE_URL, SUPABASE_ANON_KEY, STACK_PROJECT_ID.
*/
import type { Metadata } from "next";
// import { StackProvider, StackTheme } from "@stackframe/stack";
// import { stackClientApp } from "../stack/client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Letushack",
  description: "Letushack platform",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/luh_logo.ico',
    apple: '/luh_logo.png'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/luh_logo.png" />
        {/* Sansation Font from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sansation:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning={true}
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: 'Sansation, sans-serif' }}
      >
        {/* AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
            ROLLBACK_INSTRUCTIONS: Uncomment provider wrappers below and remove bypass. */}
        {children}
        {/**
        <StackProvider app={stackClientApp}>
          <StackTheme>
            {children}
          </StackTheme>
        </StackProvider>
        */}
      </body>
    </html>
  );
}