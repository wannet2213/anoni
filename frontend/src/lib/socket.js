"use client";

import { io } from "socket.io-client";
import { createContext, useContext, useEffect, useState } from "react";

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io({ transports: ["websocket", "polling"] });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
