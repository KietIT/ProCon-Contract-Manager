import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./global.css";
import { Providers } from '@/lib/providers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ProCon AI - Contract Management Platform',
  description: 'AI-powered contract management for Turnaround projects',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full light" suppressHydrationWarning>
        <head>
          {/* Prevent theme flash on load — default is light, only handle dark override */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark') document.documentElement.classList.remove('light');
              } catch(e){}
            })();
          `}} />
        </head>
        <body className={`${inter.className} min-h-screen bg-trust-blue text-white overflow-x-hidden antialiased flex flex-col`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
