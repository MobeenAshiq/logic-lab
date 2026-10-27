"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "./api/client";

let socketInstance: Socket | null = null;
let tokenPromise: Promise<string> | null = null;

async function fetchRealtimeToken(): Promise<string> {
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    try {
      const res = await api<{ token: string }>("/realtime/token");
      return res.token;
    } finally {
      tokenPromise = null;
    }
  })();
  return tokenPromise;
}

export function getRealtimeSocket(): Socket {
  if (socketInstance) return socketInstance;

  socketInstance = io({
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
  });

  socketInstance.on("connect_error", async (err) => {
    if (err.message.includes("UNAUTHENTICATED") || err.message.includes("token")) {
      try {
        const freshToken = await fetchRealtimeToken();
        if (socketInstance) {
          socketInstance.auth = { token: freshToken };
          socketInstance.connect();
        }
      } catch {
        // user might not be logged in
      }
    }
  });

  return socketInstance;
}

export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    const socket = getRealtimeSocket();

    const onConnect = () => {
      if (mounted) setIsConnected(true);
    };
    const onDisconnect = () => {
      if (mounted) setIsConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    } else {
      fetchRealtimeToken()
        .then((token) => {
          if (!mounted) return;
          socket.auth = { token };
          socket.connect();
        })
        .catch(() => {
          // unauthenticated or guest
        });
    }

    return () => {
      mounted = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return { isConnected, socket: getRealtimeSocket() };
}

export function useRealtimeEvent<T = any>(
  event: string,
  handler: (payload: T) => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getRealtimeSocket();
    const listener = (data: T) => handlerRef.current(data);

    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
