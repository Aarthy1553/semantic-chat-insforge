import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Semantic Chat',
  description: 'Real-time chat with semantic search powered by InsForge + Gemini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}