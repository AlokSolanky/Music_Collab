const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("create-room", (instrument) => {
    const roomId = generateRoomId();
    const user = { id: socket.id, instrument };

    rooms.set(roomId, {
      id: roomId,
      users: [user],
      host: socket.id,
    });

    socket.join(roomId);
    socket.emit("room-created", rooms.get(roomId));
    console.log(`Room created: ${roomId}`);
  });

  socket.on("join-room", ({ roomId, instrument }) => {
    if (!rooms.has(roomId)) {
      socket.emit("error", "Room not found");
      return;
    }

    const room = rooms.get(roomId);
    if (room.users.length >= 4) {
      socket.emit("error", "Room is full");
      return;
    }

    const user = { id: socket.id, instrument };
    room.users.push(user);

    socket.join(roomId);
    socket.emit("room-joined", room);
    io.to(roomId).emit("user-joined", user);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("audio-event", (event) => {
    const room = [...rooms.values()].find((r) =>
      r.users.some((u) => u.id === socket.id)
    );

    if (room) {
      socket.to(room.id).emit("audio-event", event);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");

    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex((u) => u.id === socket.id);
      if (userIndex !== -1) {
        const [user] = room.users.splice(userIndex, 1);
        io.to(roomId).emit("user-left", user.id);

        if (room.users.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
