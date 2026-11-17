'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import HouseHost from './HouseHost';

/** The house lives under every page that belongs to it, so moving between them never restarts the music. */
export default function Shell({ children }) {
  const path = usePathname() || '/';
  const houseRoute = path === '/' || path.startsWith('/study');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (houseRoute) setMounted(true); }, [houseRoute]);
  return (
    <>
      {children}
      {mounted && <HouseHost active={path === '/'} />}
    </>
  );
}
