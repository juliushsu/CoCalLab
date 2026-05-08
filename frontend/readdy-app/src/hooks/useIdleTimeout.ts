/**
 * useIdleTimeout
 *
 * Detects user inactivity and triggers a warning before auto-logout.
 *
 * Session policy (frontend layer):
 *   - IDLE_TIMEOUT_MS   : time of inactivity before showing warning (default 25 min)
 *   - WARNING_DURATION_S: countdown seconds shown in warning modal (default 60 s)
 *   - ABSOLUTE_LIMIT_MS : hard session ceiling regardless of activity (default 8 h)
 *     → This is a frontend guard only. The real absolute limit is enforced by
 *       Supabase JWT expiry (configured in Supabase Auth settings).
 *
 * NOTE: Supabase's default JWT expiry is 1 hour with auto-refresh enabled.
 * To change the absolute session lifetime, update the JWT expiry in the
 * Supabase dashboard → Authentication → Settings → JWT Expiry.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_TIMEOUT_MS = 25 * 60 * 1000;   // 25 minutes idle → show warning
const WARNING_DURATION_S = 60;             // 60-second countdown before auto-logout
const ABSOLUTE_LIMIT_MS = 8 * 60 * 60 * 1000; // 8-hour hard ceiling (frontend guard)

const ACTIVITY_EVENTS: string[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

interface UseIdleTimeoutOptions {
  onLogout: () => void;
  enabled?: boolean;
}

interface UseIdleTimeoutReturn {
  showWarning: boolean;
  countdown: number;
  resetIdle: () => void;
  forceLogout: () => void;
}

export function useIdleTimeout({
  onLogout,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_DURATION_S);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setCountdown(WARNING_DURATION_S);

    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          setShowWarning(false);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onLogout]);

  const resetIdle = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    setShowWarning(false);
    setCountdown(WARNING_DURATION_S);

    idleTimerRef.current = setTimeout(() => {
      startCountdown();
    }, IDLE_TIMEOUT_MS);
  }, [enabled, clearTimers, startCountdown]);

  const forceLogout = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    onLogout();
  }, [clearTimers, onLogout]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => resetIdle();

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Start idle timer on mount
    resetIdle();

    // Absolute session ceiling (frontend guard)
    absoluteTimerRef.current = setTimeout(() => {
      clearTimers();
      setShowWarning(false);
      onLogout();
    }, ABSOLUTE_LIMIT_MS - (Date.now() - sessionStartRef.current));

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();
      if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    };
  }, [enabled, resetIdle, clearTimers, onLogout]);

  return { showWarning, countdown, resetIdle, forceLogout };
}
