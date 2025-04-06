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

app.use(express.static(path.join(__dirname, "../client"))); // ADJUST IF NEEDED

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // --- MODIFIED: Request to create, only returns ID ---
  socket.on("create-room-request", (instrument) => {
    console.log(`[create-room-request] Received from ${socket.id}`);
    const roomId = generateRoomId();
    // We don't add the room to the main Map or join the socket *yet*.
    // The client will join properly using 'join-room-final' after redirect.
    console.log(
      `[create-room-request] Generated room ID ${roomId}, sending back.`
    );
    socket.emit("room-id-created", { roomId }); // Only send the ID back
  });

  // --- MODIFIED: Request to validate join ---
  socket.on("validate-join-request", ({ roomId, instrument }) => {
    console.log(
      `[validate-join-request] Received for ${roomId} from ${socket.id}`
    );
    const room = rooms.get(roomId);
    let response = { success: false, roomId: roomId, message: "" };

    if (!room) {
      response.message = "Room not found.";
      console.log(`[validate-join-request] Failed: Room ${roomId} not found.`);
    } else if (room.users.length >= 4) {
      response.message = "Room is full.";
      console.log(`[validate-join-request] Failed: Room ${roomId} is full.`);
    } else {
      response.success = true;
      response.message = "Room is valid to join.";
      console.log(`[validate-join-request] Success: Room ${roomId} is valid.`);
    }
    socket.emit("join-validated", response); // Send validation result
  });

  // --- NEW: Handles the actual joining/creation after page load ---
  socket.on("join-room-final", ({ roomId, instrument, isCreating }) => {
    console.log(
      `[join-room-final] Received for room ${roomId}, instrument ${instrument}, isCreating: ${isCreating}, from ${socket.id}`
    );
    let room;
    const userId = socket.id; // Use the *current*, stable socket ID
    const user = { id: userId, instrument: instrument };

    if (isCreating) {
      if (rooms.has(roomId)) {
        // Should ideally not happen if IDs are unique, but handle defensively
        console.error(
          `[join-room-final] CRITICAL: Tried to create room ${roomId} which already exists!`
        );
        socket.emit("error", "Failed to create room: Room ID conflict.");
        return;
      }
      // Create the room now
      room = {
        id: roomId,
        users: [user],
        host: userId,
      };
      rooms.set(roomId, room);
      console.log(
        `[join-room-final] CREATED room ${roomId} with host ${userId}`
      );
    } else {
      // Joining existing room
      room = rooms.get(roomId);
      if (!room) {
        console.log(`[join-room-final] Join failed: Room ${roomId} not found.`);
        socket.emit("error", "Room not found.");
        return;
      }
      if (room.users.length >= 4) {
        console.log(`[join-room-final] Join failed: Room ${roomId} is full.`);
        socket.emit("error", "Room is full.");
        return;
      }
      // Add user to the existing room
      room.users.push(user);
      console.log(
        `[join-room-final] User ${userId} added to existing room ${roomId}`
      );
    }

    // Join the Socket.IO room (crucial)
    socket.join(roomId);
    console.log(
      `[join-room-final] Socket ${socket.id} joined Socket.IO room ${roomId}`
    );

    // Send the final room state back to the joining/creating user
    socket.emit("room-state", { room: room, currentUserId: userId }); // Send userId too
    console.log(
      `[join-room-final] Emitted 'room-state' for ${roomId} to ${userId}`
    );

    // Notify others (only if joining, not creating the very first user)
    if (!isCreating) {
      socket.to(roomId).emit("user-joined", user);
      console.log(
        `[join-room-final] Broadcast 'user-joined' for ${userId} in room ${roomId}`
      );
    }
  });

  // --- REMOVED 'register-socket' handler ---
  // It's replaced by 'join-room-final'

  // Handle incoming audio events (No changes needed)
  socket.on("audio-event", (event) => {
    let userRoomId = null;
    rooms.forEach((room, roomId) => {
      if (room.users.some((u) => u.id === socket.id)) userRoomId = roomId;
    });
    if (userRoomId) {
      event.senderId = socket.id;
      socket.to(userRoomId).emit("audio-event", event);
    } else {
      console.log(`Could not find room for audio event from ${socket.id}`);
    }
  });

  // Handle client disconnection (Uses current socket.id correctly now)
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const userId = socket.id; // This IS the ID of the user who was in room.html
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        const [user] = room.users.splice(userIndex, 1);
        console.log(`User ${userId} left room ${roomId}`);
        socket.to(roomId).emit("user-left", userId);
        if (room.users.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} is empty, deleting.`);
        } else {
          if (room.host === userId) {
            room.host = room.users[0].id;
            console.log(
              `Host ${userId} left room ${roomId}. New host is ${room.host}.`
            );
            io.to(roomId).emit("new-host", room.host); // Notify about new host
          }
        }
        return; // User found and removed, stop iterating
      }
    });
  });
});

// Simple unique room ID generator
function generateRoomId() {
  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms.has(newId));
  return newId;
}

const PORT = process.env.PORT || 3001;
// *** MODIFIED LINE HERE ***
// Listen on 0.0.0.0 to accept connections from the network, not just localhost
server.listen(PORT, "0.0.0.0", () => {
  // You can optionally log the network address too, but finding it automatically
  // can be complex, so usually, you just find it manually as described above.
  console.log(
    `Server running on port ${PORT} and accessible on the local network.`
  );
  console.log(
    `Other devices on the network should connect to this machine's IP address.`
  );
});
