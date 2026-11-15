import { io } from "socket.io-client";

let socket = null;
let activeToken = null;

export function getSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (socket && activeToken === token) return socket;
  socket?.disconnect();
  activeToken = token;
  socket = io({
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}
