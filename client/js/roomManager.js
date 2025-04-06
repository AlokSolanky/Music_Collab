// Global state for room page
const roomState = {
  socket: null,
  currentRoom: null,
  users: [], // Initialize as empty array
  instrument: null,
  roomId: null, // Store roomId
  userId: null, // Store userId
};

// DOM elements cache (optional but good practice)
const roomElements = {
  roomIdDisplay: document.getElementById("roomIdDisplay"),
  playerCount: document.getElementById("playerCount"),
  usersList: document.getElementById("usersList"),
  instrumentContainer: document.getElementById("instrumentContainer"),
  // Add other frequently accessed elements if needed
};

// Initialize room page
function initRoom() {
  const params = new URLSearchParams(window.location.search);
  roomState.roomId = params.get("roomId");
  roomState.instrument = params.get("instrument");
  // Retrieve userId stored by app.js
  roomState.userId = sessionStorage.getItem("userId");

  if (!roomState.roomId || !roomState.instrument) {
    console.error("Room ID or Instrument missing from URL params.");
    alert("Error: Could not load room. Missing details.");
    window.location.href = "index.html"; // Redirect back
    return;
  }
  if (!roomState.userId) {
    console.error("User ID missing from session storage.");
    alert("Error: Could not verify user. Please try joining again.");
    // Optionally clear sessionStorage?
    window.location.href = "index.html"; // Redirect back
    return;
  }

  document.title = `${
    roomState.instrument.charAt(0).toUpperCase() + roomState.instrument.slice(1)
  } - Room ${roomState.roomId}`;

  // Initial UI update
  if (roomElements.roomIdDisplay)
    roomElements.roomIdDisplay.textContent = `Room: ${roomState.roomId}`;
  updatePlayerCount(); // Update count based on initial empty state

  loadInstrumentInterface(roomState.instrument);
  connectRoomSocket(roomState.roomId, roomState.instrument); // Pass necessary info
  setupAudio();
}

// Load the appropriate instrument interface (CSS and JS)
function loadInstrumentInterface(instrument) {
  if (!roomElements.instrumentContainer) {
    console.error("Instrument container not found!");
    return;
  }

  // Load CSS specific to the instrument
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `css/${instrument}.css`;
  link.id = `${instrument}-css`; // Add ID for potential removal later if needed
  document.head.appendChild(link);

  // Load JS specific to the instrument
  const script = document.createElement("script");
  script.src = `js/${instrument}.js`;
  script.onload = () => {
    // Dynamically find and call the init function (e.g., initGuitarInterface)
    const initFunctionName = `init${
      instrument.charAt(0).toUpperCase() + instrument.slice(1)
    }Interface`;
    if (typeof window[initFunctionName] === "function") {
      try {
        window[initFunctionName](roomState.socket); // Pass socket if instrument JS needs it
      } catch (error) {
        console.error(`Error initializing interface for ${instrument}:`, error);
      }
    } else {
      console.warn(`Initialization function ${initFunctionName} not found.`);
    }
  };
  script.onerror = () =>
    console.error(`Failed to load script for ${instrument}.js`);
  document.body.appendChild(script);
}

// Connect to room via Socket.io
function connectRoomSocket(roomId, instrument) {
  // Prevent multiple connections if initRoom was called again somehow
  if (roomState.socket) return;

  roomState.socket = io("http://localhost:3001"); // Ensure URL matches server

  // --- Event handler for successful connection ---
  roomState.socket.on("connect", () => {
    console.log("Socket connected:", roomState.socket.id);
    // *** Emit the event to register this socket with the room on the server ***
    console.log(
      `Emitting register-socket for room ${roomId}, user ${roomState.userId}`
    );
    roomState.socket.emit("register-socket", {
      roomId: roomId,
      userId: roomState.userId,
    });
  });

  // --- Listener for the server sending the current room state after registration ---
  roomState.socket.on("room-state", (room) => {
    console.log("Received room state:", room);
    if (room && room.users) {
      roomState.currentRoom = room;
      roomState.users = room.users; // Update local user list
      updateRoomUI(room); // Update the entire UI based on the received state
    } else {
      console.error("Invalid room state received:", room);
    }
  });

  // --- Listeners for real-time updates ---
  roomState.socket.on("user-joined", (newUser) => {
    console.log("User joined:", newUser);
    // Avoid adding duplicates if room-state arrives slightly later
    if (newUser && !roomState.users.some((u) => u.id === newUser.id)) {
      roomState.users.push(newUser);
      updateUsersList(); // Update only the list
      updatePlayerCount(); // Update the count display
    }
  });

  roomState.socket.on("user-left", (leftUserId) => {
    console.log("User left:", leftUserId);
    const initialLength = roomState.users.length;
    roomState.users = roomState.users.filter((u) => u.id !== leftUserId);
    // Only update UI if a user was actually removed
    if (roomState.users.length < initialLength) {
      updateUsersList();
      updatePlayerCount();
    }
  });

  // --- Listener for audio events from other users ---
  roomState.socket.on("audio-event", (event) => {
    // Optional: Filter out events from self if server doesn't handle this
    // if (event.senderId === roomState.userId) return;
    // console.log("Received audio event:", event);
    handleIncomingAudioEvent(event);
  });

  // --- Centralized error handling for this page ---
  roomState.socket.on("error", (message) => {
    console.error("Server error on room page:", message);
    alert(`Error: ${message}`);
    // Optional: Redirect if the error is critical (e.g., room kicked from)
    // Consider specific error messages from server for this
    if (message.includes("Room not found")) {
      window.location.href = "index.html";
    }
  });

  // Handle connection errors
  roomState.socket.on("connect_error", (err) => {
    console.error("Room connection failed:", err.message);
    alert("Lost connection to the server. Please try rejoining.");
    window.location.href = "index.html"; // Redirect on connection failure
  });

  roomState.socket.on("disconnect", (reason) => {
    console.log("Disconnected from server:", reason);
    alert("You have been disconnected. Please rejoin the room.");
    window.location.href = "index.html"; // Redirect on disconnection
  });
}

// Update room information (player count)
function updatePlayerCount() {
  const count = roomState.users ? roomState.users.length : 0;
  if (roomElements.playerCount)
    roomElements.playerCount.textContent = `Players: ${count}/4`;
}

// Update the visual list of users
function updateUsersList() {
  if (!roomElements.usersList) return;

  roomElements.usersList.innerHTML = (roomState.users || []) // Ensure users is an array
    .map(
      (user) => `
    <li class="user-item ${
      user.id === roomState.userId ? "current-user" : ""
    }" data-userid="${user.id}">
      <span class="user-icon">${getInstrumentIcon(user.instrument)}</span>
      <span class="user-name">${user.instrument}</span>
      ${user.id === roomState.userId ? " (You)" : ""}
      ${
        roomState.currentRoom && user.id === roomState.currentRoom.host
          ? " (Host)"
          : ""
      }
    </li>
  `
    )
    .join("");
}

// Update room UI (called initially from room-state)
function updateRoomUI(room) {
  if (!room) return;
  if (roomElements.roomIdDisplay)
    roomElements.roomIdDisplay.textContent = `Room: ${room.id}`;
  updatePlayerCount(); // Update count based on the received state
  updateUsersList(); // Update the user list
}

// Handle incoming audio events from other users
function handleIncomingAudioEvent(event) {
  // console.log("Handling incoming audio:", event); // Debug log
  // Example: Find function based on instrument type (requires convention)
  const instrument = event.instrument; // Assuming event includes instrument type
  const handlerFunctionName = `playRemote${
    instrument.charAt(0).toUpperCase() + instrument.slice(1)
  }Sound`;

  if (typeof window[handlerFunctionName] === "function") {
    try {
      window[handlerFunctionName](event); // Pass the whole event data
    } catch (error) {
      console.error(
        `Error in remote play handler ${handlerFunctionName}:`,
        error
      );
    }
  } else {
    // console.warn(`Remote play handler function ${handlerFunctionName} not found.`);
    // Fallback or generic visual cue if specific handler missing
    if (typeof window.playRemoteSound === "function") {
      // Check for a generic handler
      window.playRemoteSound(event);
    }
  }
}

// Get instrument icon (utility)
function getInstrumentIcon(instrument) {
  const icons = {
    guitar: "🎸",
    piano: "🎹",
    drums: "🥁",
    vocal: "🎤",
  };
  return icons[instrument] || "🎵"; // Fallback icon
}

// Setup audio context on user interaction
function setupAudio() {
  // Use a more robust way to enable audio, maybe a dedicated button
  const startAudioButton = document.getElementById("startAudioButton"); // Assume you add this button
  if (startAudioButton) {
    startAudioButton.addEventListener(
      "click",
      async () => {
        try {
          await Tone.start();
          console.log("Audio Context is running");
          startAudioButton.style.display = "none"; // Hide button after success
          // You might want to initialize Tone instruments here AFTER context is running
          if (typeof window.initializeAudioEngine === "function") {
            window.initializeAudioEngine();
          }
        } catch (e) {
          console.error("Failed to start Audio Context:", e);
          alert("Could not enable audio. Please check browser permissions.");
        }
      },
      { once: true }
    ); // Remove listener after first click
  } else {
    // Fallback if button doesn't exist (less reliable)
    document.body.addEventListener(
      "click",
      async () => {
        if (Tone.context.state !== "running") {
          await Tone.start();
          console.log("Audio Context started via body click.");
          if (typeof window.initializeAudioEngine === "function") {
            window.initializeAudioEngine();
          }
        }
      },
      { once: true }
    );
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initRoom);
