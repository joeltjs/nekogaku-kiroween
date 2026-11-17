'use client';
import { useState } from 'react';

export default function EnterForm({ next }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const r = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setState({ busy: false, error: data.error || 'The door stays shut.' }); return; }
      location.href = next || '/';
    } catch { setState({ busy: false, error: 'The house is not answering. Try again.' }); }
  }
  return (
    <form className="door-form" onSubmit={submit}>
      <label htmlFor="code">Access code</label>
      <input id="code" name="code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="NEKO-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck="false" maxLength={16} required aria-describedby="door-error" />
      <button type="submit" className="primary" disabled={state.busy}>{state.busy ? 'Opening…' : 'Open the door'}</button>
      <p id="door-error" className="door-error" role="alert">{state.error}</p>
    </form>
  );
}
