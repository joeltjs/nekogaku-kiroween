'use client';
import { useEffect, useState } from 'react';
import { readSound, writeSound } from './sound';

/** Turns all sound off or on: the house music, the cats' sounds and the VOICEVOX voices. */
export default function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => { const p = readSound(); setOn(p.music || p.effects || p.voice); }, []);
  function toggle() {
    const next = !on;
    writeSound({ music: next, effects: next, voice: next });
    setOn(next);
  }
  return <button type="button" className="g-sound" aria-pressed={on} onClick={toggle}>{on ? 'Sound on' : 'Sound off'}</button>;
}
