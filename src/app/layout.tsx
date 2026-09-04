import './globals.css';
import type { Metadata } from 'next';
import { AuthNav } from '@/components/auth-nav';
import { TikTokPublisher } from '@/components/tiktok-publisher';

export const metadata: Metadata = {
  title: 'ShortForge AI — AI-powered short-form studio',
  description: 'Turn long-form YouTube videos into research-backed Shorts, TikToks and Reels.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-5">
          <AuthNav />
        </div>
        {children}
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
          <TikTokPublisher />
        </div>
      </body>
    </html>
  );
}
