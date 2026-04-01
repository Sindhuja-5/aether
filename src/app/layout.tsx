import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { auth0 } from "@/lib/auth0";
import { SidebarProvider } from "@/context/SidebarContext";
import { Toaster } from "@/components/ui/sonner";
import LayoutClient from "./layout-client";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aether | Premium Blog Platform",
  description: "Explore pure ideas and insights on Aether.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth0.getSession();
  const user = session?.user;
  const isLoggedIn = !!user;

  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-blue-100 flex flex-col min-h-screen bg-gray-50`}
      >
        <SidebarProvider>
          <Suspense fallback={null}>
            <Navbar user={user || null} />
          </Suspense>
          <div className="flex flex-1 relative min-h-screen">
            {isLoggedIn && <Sidebar />}
            <LayoutClient isLoggedIn={isLoggedIn}>
              {children}
            </LayoutClient>
          </div>
        </SidebarProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
