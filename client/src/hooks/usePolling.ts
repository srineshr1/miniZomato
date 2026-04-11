import { useEffect, useRef, useCallback } from 'react';

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  onSuccess?: (data: T) => void,
  onError?: (err: unknown) => void,
) {
  const savedFn = useRef(fetchFn);
  const savedOnSuccess = useRef(onSuccess);
  const savedOnError = useRef(onError);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  savedFn.current = fetchFn;
  savedOnSuccess.current = onSuccess;
  savedOnError.current = onError;

  const poll = useCallback(async () => {
    try {
      const data = await savedFn.current();
      if (mountedRef.current) {
        savedOnSuccess.current?.(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        savedOnError.current?.(err);
      }
    } finally {
      if (mountedRef.current) {
        timerRef.current = setTimeout(poll, intervalMs);
      }
    }
  }, [intervalMs]);

  useEffect(() => {
    mountedRef.current = true;
    poll();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [poll]);
}