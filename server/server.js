const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity, adjust for production
    methods: ["GET", "POST"],
  },
});

// In-memory storage for rooms. Consider a database for persistence.
const rooms = new Map();

// Serve static files (assuming your client files are in a 'public' directory sibling to server.js)
// If your client files (index.html, etc.) are in the 'client' folder, change 'public' to '../client'
app.use(express.static(path.join(__dirname, "../client"))); // ADJUST IF NEEDED

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Handle room creation
  socket.on("create-room", (instrument) => {
    const roomId = generateRoomId();
    const userId = socket.id; // Use socket ID as unique user ID for this room session
    const user = { id: userId, instrument: instrument };

    rooms.set(roomId, {
      id: roomId,
      users: [user], // List of users in the room
      host: userId, // ID of the user who created the room
    });

    socket.join(roomId); // Make the socket join the Socket.IO room
    // Send back the room details and the user's ID
    socket.emit("room-created", { room: rooms.get(roomId), userId: userId });
    console.log(`Room ${roomId} created by user ${userId}`);
  });

  // Handle joining an existing room
  socket.on("join-room", ({ roomId, instrument }) => {
    const room = rooms.get(roomId);

    // Check if room exists
    if (!room) {
      socket.emit("error", "Room not found");
      console.log(`Join attempt failed: Room ${roomId} not found.`);
      return;
    }

    // Check if room is full
    if (room.users.length >= 4) {
      socket.emit("error", "Room is full");
      console.log(`Join attempt failed: Room ${roomId} is full.`);
      return;
    }

    const userId = socket.id; // Use socket ID as unique user ID
    const user = { id: userId, instrument: instrument };
    room.users.push(user); // Add user to the room's user list

    socket.join(roomId); // Make the socket join the Socket.IO room
    // Send confirmation and room details back to the joining user
    socket.emit("room-joined", { room: room, userId: userId });
    // Notify others in the room that a new user joined
    socket.to(roomId).emit("user-joined", user);
    console.log(`User ${userId} joined room: ${roomId}`);
  });

  // Handle socket registration after client navigates to room.html
  socket.on("register-socket", ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room) {
      // Verify the user (identified by userId from sessionStorage) exists in the room
      const userIndex = room.users.findIndex((u) => u.id === userId);

      // *** FIX APPLIED HERE ***
      // We check if the user ID exists in the room's list.
      // We DON'T compare the current socket.id with the userId from sessionStorage,
      // because they *will* be different after the page redirect.
      if (userIndex !== -1) {
        socket.join(roomId); // Join the Socket.IO room with the *current* socket

        // Optional: Update the user's stored ID to the current socket ID if needed elsewhere.
        // This might be useful if you ever need to send a message directly to this specific socket.
        // room.users[userIndex].id = socket.id; // Be cautious if you rely on the original ID elsewhere
        // console.log(`User ${userId} re-registered with new socket ID ${socket.id} in room ${roomId}`);
        // If you uncomment the line above, make sure disconnect logic uses the *current* ID.

        console.log(
          `Socket ${socket.id} (representing user ${userId}) registered for room ${roomId}`
        );

        // Send the current state of the room back to this newly registered socket
        socket.emit("room-state", room);
      } else {
        console.log(
          `Registration failed: User ${userId} not found in room ${roomId}`
        );
        socket.emit("error", "Registration failed: User not found in room.");
      }
    } else {
      console.log(
        `Registration failed: Room ${roomId} not found for socket ${socket.id}`
      );
      // Send the specific error the user reported seeing
      socket.emit("error", "Error: Room not found during registration");
    }
  });

  // Handle incoming audio events
  socket.on("audio-event", (event) => {
    // Find which room the sending socket belongs to
    let userRoomId = null;
    rooms.forEach((room, roomId) => {
      if (room.users.some((u) => u.id === socket.id)) {
        userRoomId = roomId;
      }
    });

    if (userRoomId) {
      // Add sender's ID to the event so clients can identify who played
      event.senderId = socket.id;
      // Broadcast the event to others in the same room
      socket.to(userRoomId).emit("audio-event", event);
    } else {
      console.log(`Could not find room for audio event from ${socket.id}`);
    }
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const userId = socket.id; // User ID is the socket ID in this setup

    // Find which room the disconnected user was in
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex((u) => u.id === userId);

      if (userIndex !== -1) {
        // Remove user from the room's list
        const [user] = room.users.splice(userIndex, 1);
        console.log(`User ${userId} left room ${roomId}`);

        // Notify remaining users in the room
        socket.to(roomId).emit("user-left", userId);

        // Check if the room is now empty
        if (room.users.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} is empty, deleting.`);
        } else {
          // Optional: Handle host leaving - assign a new host if needed
          if (room.host === userId) {
            room.host = room.users[0].id; // Assign the next user as host
            console.log(
              `Host ${userId} left room ${roomId}. New host is ${room.host}.`
            );
            // Optionally notify clients about the new host
            // io.to(roomId).emit('new-host', room.host);
          }
        }
        // Assuming a user can only be in one room, we can stop searching
        return;
      }
    });
  });
});

// Simple unique room ID generator
function generateRoomId() {
  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms.has(newId)); // Ensure ID is truly unique
  return newId;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
