import './globals.css';
import type { Metadata } from 'next';
import { AuthNav } from '@/components/auth-nav';

export const metadata: Metadata = {
  title: 'ShortForge AI — Turn long videos into better shorts',
  description: 'AI-assisted short-form video research, clipping and platform optimization.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fixed right-5 top-5 z-40 flex items-center gap-2">
          <AuthNav />
        </div>
        {children}
      </body>
    </html>
  );
}
