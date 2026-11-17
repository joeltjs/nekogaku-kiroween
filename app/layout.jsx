import Shell from '../components/Shell';
import './globals.css';

export const metadata = {
  title: 'NekoGaku · Kiroween',
  description: 'A haunted cat house stitched to a JLPT N5–N1 and SSW grimoire. Study Japanese, grow your cats.',
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f0a14' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
