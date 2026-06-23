import type { Metadata } from 'next';
import './globals.css';
import { RootLayoutClient } from './RootLayoutClient';

export const metadata: Metadata = {
  title: 'CUBEX - AI Video Studio',
  description: 'AI-powered creative workspace',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
