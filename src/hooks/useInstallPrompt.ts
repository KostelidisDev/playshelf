import { useCallback, useEffect, useState } from "react";

/** A function that shows the browser's install prompt, or null when the
 * browser isn't offering one. */
export function useInstallPrompt(): (() => void) | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    setDeferred(null);
    void deferred.prompt();
  }, [deferred]);

  return deferred ? install : null;
}
