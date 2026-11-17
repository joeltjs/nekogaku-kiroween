'use client';

export default function SignOut({ className = 'g-signout' }) {
  async function out() {
    await fetch('/api/session', { method: 'DELETE' }).catch(() => {});
    location.href = '/login';
  }
  return <button type="button" className={className} onClick={out}>Sign out</button>;
}
