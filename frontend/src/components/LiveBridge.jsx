import { useEffect } from "react";
import { useAuth } from "../auth.jsx";
import { useToast } from "./Toast.jsx";
import { disconnectSocket, getSocket } from "../socket";

export default function LiveBridge() {
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return undefined;
    }
    const socket = getSocket();
    if (!socket) return undefined;
    const onRelease = (payload) => {
      toast(payload?.message || "Your bay hold was released.", "info");
    };
    socket.on("booking:released", onRelease);
    return () => socket.off("booking:released", onRelease);
  }, [user, toast]);

  return null;
}
