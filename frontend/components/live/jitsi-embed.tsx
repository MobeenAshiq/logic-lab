"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface JitsiEmbedProps {
  roomName: string;
  displayName: string;
  domain?: string;
  onJoin?: () => void;
  onLeave?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

export function JitsiEmbed({
  roomName,
  displayName,
  domain = "meet.jit.si",
  onJoin,
  onLeave,
}: JitsiEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Call onJoin on mount, onLeave on unmount
  useEffect(() => {
    onJoin?.();
    return () => {
      onLeave?.();
    };
  }, [onJoin, onLeave]);

  // Load external script
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      // Fallback: we will render standard iframe
      setScriptLoaded(false);
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      // Keep script in document
    };
  }, [domain]);

  // Initialize Jitsi API
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || apiRef.current) return;

    try {
      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted: true,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
      });

      apiRef.current = api;
      setLoading(false);

      api.addEventListener("videoConferenceLeft", () => {
        onLeave?.();
      });
    } catch {
      setLoading(false);
    }

    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch {
          // ignore
        }
        apiRef.current = null;
      }
    };
  }, [domain, roomName, displayName, scriptLoaded, onLeave]);

  return (
    <div className="relative w-full h-[600px] sm:h-[700px] rounded-xl overflow-hidden border bg-black shadow-lg">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-10 gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Connecting to live classroom...
          </p>
        </div>
      )}

      {/* Fallback direct iframe if external_api fails */}
      {!scriptLoaded && !loading ? (
        <iframe
          src={`https://${domain}/${roomName}#userInfo.displayName="${encodeURIComponent(
            displayName,
          )}"`}
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          className="w-full h-full border-0"
        />
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
}
