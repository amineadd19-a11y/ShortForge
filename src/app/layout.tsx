import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ShortForge AI — Turn long videos into better shorts',
  description: 'AI-assisted short-form video research, clipping and platform optimization.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
