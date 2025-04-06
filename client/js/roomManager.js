// Global state for room page
const roomState = {
  socket: null,
  currentRoom: null,
  users: [],
  instrument: null,
  roomId: null,
  userId: null, // Will be set by the server upon joining
  isCreating: false, // Track if this client initiated room creation
};

// DOM elements cache
const roomElements = {
  roomIdDisplay: document.getElementById("roomIdDisplay"),
  playerCount: document.getElementById("playerCount"),
  usersList: document.getElementById("usersList"),
  instrumentContainer: document.getElementById("instrumentContainer"),
  startAudioButton: document.getElementById("startAudioButton"), // For enabling audio
};

// Initialize room page
function initRoom() {
  const params = new URLSearchParams(window.location.search);
  roomState.roomId = params.get("roomId");
  roomState.instrument = params.get("instrument");
  const action = params.get("action"); // 'create' or 'join'

  if (!roomState.roomId || !roomState.instrument || !action) {
    console.error("Room ID, Instrument, or Action missing from URL params.");
    alert("Error: Could not load room. Missing details.");
    window.location.href = "index.html";
    return;
  }

  roomState.isCreating = action === "create"; // Set flag if creating

  document.title = `${
    roomState.instrument.charAt(0).toUpperCase() + roomState.instrument.slice(1)
  } - Room ${roomState.roomId}`;
  if (roomElements.roomIdDisplay)
    roomElements.roomIdDisplay.textContent = `Room: ${roomState.roomId} (Connecting...)`;
  updatePlayerCount(); // Initial count is 0

  loadInstrumentInterface(roomState.instrument);
  connectAndJoinRoomSocket(
    roomState.roomId,
    roomState.instrument,
    roomState.isCreating
  ); // Pass create flag
  setupAudio(); // Setup audio enable button/logic
}

// Load the appropriate instrument interface (CSS and JS)
function loadInstrumentInterface(instrument) {
  if (!roomElements.instrumentContainer) {
    console.error("Instrument container not found!");
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `css/${instrument}.css`;
  link.id = `${instrument}-css`;
  document.head.appendChild(link);
  const script = document.createElement("script");
  script.src = `js/${instrument}.js`;
  script.onload = () => {
    const initFunctionName = `init${
      instrument.charAt(0).toUpperCase() + instrument.slice(1)
    }Interface`;
    if (typeof window[initFunctionName] === "function") {
      try {
        window[initFunctionName](roomState.socket);
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

// Connect socket AND perform the final join/create action
function connectAndJoinRoomSocket(roomId, instrument, isCreating) {
  if (roomState.socket) return; // Prevent multiple connections

  // *** MODIFIED LINE HERE ***
  // Replace "YOUR_SERVER_LOCAL_IP" with the actual IP of the machine running the server.
  // Make sure it includes http:// and the correct port (:3001).
  const SERVER_URL = "http://192.168.1.45:3001";
  // Example: const SERVER_URL = "http://192.168.1.100:3001";

  console.log(
    `Attempting to connect to server at ${SERVER_URL} for room ${roomId}`
  ); // Log the URL
  roomState.socket = io(SERVER_URL); // Use the server's local IP

  roomState.socket.on("connect", () => {
    console.log("Socket connected:", roomState.socket.id);
    // *** Emit the final join/create event AFTER connecting ***
    console.log(
      `Emitting 'join-room-final': roomId=${roomId}, instrument=${instrument}, isCreating=${isCreating}`
    );
    roomState.socket.emit("join-room-final", {
      roomId: roomId,
      instrument: instrument,
      isCreating: isCreating, // Tell server if we are creating this room
    });
  });

  // --- Listener for the server confirming join and sending initial state ---
  roomState.socket.on("room-state", ({ room, currentUserId }) => {
    console.log("Received room state:", room, "My User ID:", currentUserId);
    if (room && room.users && currentUserId) {
      roomState.currentRoom = room;
      roomState.users = room.users;
      roomState.userId = currentUserId; // Set the user ID assigned by the server
      updateRoomUI(room); // Update UI with received state
      if (roomElements.roomIdDisplay)
        roomElements.roomIdDisplay.textContent = `Room: ${room.id}`; // Update status
    } else {
      console.error("Invalid room state received:", room);
      alert("Failed to initialize room state.");
      // window.location.href = 'index.html'; // Consider redirecting
    }
  });

  // Listeners for real-time updates (user joined/left)
  roomState.socket.on("user-joined", (newUser) => {
    console.log("User joined:", newUser);
    if (newUser && !roomState.users.some((u) => u.id === newUser.id)) {
      roomState.users.push(newUser);
      updateUsersList();
      updatePlayerCount();
    }
  });
  roomState.socket.on("user-left", (leftUserId) => {
    console.log("User left:", leftUserId);
    const initialLength = roomState.users.length;
    roomState.users = roomState.users.filter((u) => u.id !== leftUserId);
    if (roomState.users.length < initialLength) {
      updateUsersList();
      updatePlayerCount();
    }
  });
  roomState.socket.on("new-host", (newHostId) => {
    console.log("New host assigned:", newHostId);
    if (roomState.currentRoom) roomState.currentRoom.host = newHostId;
    updateUsersList(); // Re-render list to show new host potentially
  });

  // Listener for audio events from others
  roomState.socket.on("audio-event", (event) => {
    handleIncomingAudioEvent(event);
  });

  // Centralized error handling
  roomState.socket.on("error", (message) => {
    console.error("Server error on room page:", message);
    alert(`Error: ${message}`);
    if (
      message.includes("Room not found") ||
      message.includes("Room is full")
    ) {
      window.location.href = "index.html";
    }
  });
  roomState.socket.on("connect_error", (err) => {
    console.error(`Room connection failed to ${SERVER_URL}:`, err.message); // Include URL in error
    alert(
      `Lost connection to the server at ${SERVER_URL}. Please try rejoining.`
    );
    window.location.href = "index.html";
  });
  roomState.socket.on("disconnect", (reason) => {
    console.log("Disconnected from server:", reason);
    alert("You have been disconnected. Please rejoin the room.");
    window.location.href = "index.html";
  });
}

// --- UI Update Functions ---

function updatePlayerCount() {
  const count = roomState.users ? roomState.users.length : 0;
  if (roomElements.playerCount)
    roomElements.playerCount.textContent = `Players: ${count}/4`;
}

function updateUsersList() {
  if (!roomElements.usersList) return;
  roomElements.usersList.innerHTML = (roomState.users || [])
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
          ? ' <span class="host-tag">(Host)</span>'
          : ""
      }
    </li>
  `
    )
    .join("");
}

function updateRoomUI(room) {
  if (!room) return;
  if (roomElements.roomIdDisplay)
    roomElements.roomIdDisplay.textContent = `Room: ${room.id}`;
  updatePlayerCount();
  updateUsersList();
}

// Handle incoming audio events
function handleIncomingAudioEvent(event) {
  // Assuming the event includes instrument info, e.g., event.instrument
  const instrument = event.instrument; // Adjust if event structure is different
  if (!instrument) {
    console.warn("Audio event received without instrument type:", event);
    // Optionally handle generic events or ignore
    if (typeof window.playRemoteSound === "function") {
      window.playRemoteSound(event); // Try a generic handler
    }
    return;
  }

  const handlerFunctionName = `playRemote${
    instrument.charAt(0).toUpperCase() + instrument.slice(1)
  }Sound`; // e.g., playRemoteGuitarSound

  if (typeof window[handlerFunctionName] === "function") {
    try {
      // Pass necessary details from the event to the handler
      // Example: window[handlerFunctionName](event.details);
      window[handlerFunctionName](event); // Adjust based on what handlers expect
    } catch (error) {
      console.error(
        `Error in remote play handler ${handlerFunctionName}:`,
        error
      );
    }
  } else {
    // Fallback if specific handler is missing
    if (typeof window.playRemoteSound === "function") {
      window.playRemoteSound(event);
    } else {
      // console.warn(`Remote play handler function ${handlerFunctionName} not found.`);
    }
  }
}

// Get instrument icon
function getInstrumentIcon(instrument) {
  const icons = { guitar: "🎸", piano: "🎹", drums: "🥁", vocal: "🎤" };
  return icons[instrument] || "🎵";
}

// Setup audio context
function setupAudio() {
  if (roomElements.startAudioButton) {
    roomElements.startAudioButton.addEventListener(
      "click",
      async () => {
        try {
          await Tone.start();
          console.log("Audio Context is running");
          roomElements.startAudioButton.style.display = "none";
          // Initialize the main audio engine *after* context is running
          if (typeof window.initializeAudioEngine === "function") {
            // Check if audioEngine.js exposes this
            window.initializeAudioEngine();
          } else if (
            typeof audioEngine !== "undefined" &&
            typeof audioEngine.init === "function"
          ) {
            // Or maybe directly call if audioEngine is global and has init
            audioEngine.init();
          }
        } catch (e) {
          console.error("Failed to start Audio Context:", e);
          alert(
            "Could not enable audio. Please check browser settings/permissions."
          );
        }
      },
      { once: true }
    );
  } else {
    // Fallback: Less reliable, might not work on all browsers/interactions
    document.body.addEventListener(
      "click",
      async () => {
        if (typeof Tone !== "undefined" && Tone.context.state !== "running") {
          try {
            await Tone.start();
            console.log("Audio Context started via body click.");
            if (typeof window.initializeAudioEngine === "function") {
              window.initializeAudioEngine();
            } else if (
              typeof audioEngine !== "undefined" &&
              typeof audioEngine.init === "function"
            ) {
              audioEngine.init();
            }
          } catch (e) {
            console.error("Failed to start Audio Context via body click:", e);
          }
        }
      },
      { once: true }
    );
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initRoom);
