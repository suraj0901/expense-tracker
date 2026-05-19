/**
 * VoiceInput — mic button that transcribes speech via Web Speech API.
 *
 * Transcript pops into the chat input. The user reviews and sends.
 * Falls back gracefully when SpeechRecognition is unavailable.
 */

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type State = 'idle' | 'listening' | 'error';

export function VoiceInput({ onTranscript, disabled }: Props) {
  const [state, setState] = useState<State>('idle');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<number>(0);

  const isSupported = typeof SpeechRecognition !== 'undefined'
    || typeof webkitSpeechRecognition !== 'undefined';

  const startListening = useCallback(() => {
    if (!isSupported) return;
    const Ctor = SpeechRecognition ?? webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    recognitionRef.current = rec;

    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript.trim());
      setState('idle');
    };

    rec.onerror = () => {
      setState('error');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setState('idle'), 2000);
    };

    rec.onend = () => { setState('idle'); };

    rec.start();
    setState('listening');
  }, [isSupported, onTranscript]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className={`voice-btn ${state === 'listening' ? 'listening' : ''}`}
      onClick={startListening}
      disabled={disabled || state === 'listening'}
      title={state === 'listening' ? 'Listening...' : 'Voice input'}
      aria-label="Voice input"
    >
      {state === 'idle' && <Mic className="mic-icon" />}
      {state === 'listening' && <MicOff className="mic-icon" />}
      {state === 'error' && <AlertTriangle className="mic-icon" />}
    </button>
  );
}
