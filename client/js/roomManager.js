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

  // Remove userId handling from sessionStorage - server assigns it now
  // roomState.userId = sessionStorage.getItem("userId"); // NO LONGER NEEDED

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

// Load the appropriate instrument interface (CSS and JS) - unchanged
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

  roomState.socket = io("http://localhost:3001");

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

  // Listeners for real-time updates (user joined/left) - unchanged needed
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
    // Optionally display a message
  });

  // Listener for audio events from others - unchanged needed
  roomState.socket.on("audio-event", (event) => {
    handleIncomingAudioEvent(event);
  });

  // Centralized error handling - unchanged needed
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
    console.error("Room connection failed:", err.message);
    alert("Lost connection to the server. Please try rejoining.");
    window.location.href = "index.html";
  });
  roomState.socket.on("disconnect", (reason) => {
    console.log("Disconnected from server:", reason);
    alert("You have been disconnected. Please rejoin the room.");
    window.location.href = "index.html";
  });
}

// --- UI Update Functions --- (Mostly unchanged, ensure they use roomElements)

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

// Handle incoming audio events (no changes needed)
function handleIncomingAudioEvent(event) {
  const instrument = event.instrument;
  const handlerFunctionName = `playRemote${
    instrument.charAt(0).toUpperCase() + instrument.slice(1)
  }Sound`;
  if (typeof window[handlerFunctionName] === "function") {
    try {
      window[handlerFunctionName](event);
    } catch (error) {
      console.error(
        `Error in remote play handler ${handlerFunctionName}:`,
        error
      );
    }
  } else {
    if (typeof window.playRemoteSound === "function") {
      window.playRemoteSound(event);
    }
  }
}

// Get instrument icon (no changes needed)
function getInstrumentIcon(instrument) {
  const icons = { guitar: "🎸", piano: "🎹", drums: "🥁", vocal: "🎤" };
  return icons[instrument] || "🎵";
}

// Setup audio context (no changes needed, assuming button exists)
function setupAudio() {
  if (roomElements.startAudioButton) {
    roomElements.startAudioButton.addEventListener(
      "click",
      async () => {
        try {
          await Tone.start();
          console.log("Audio Context is running");
          roomElements.startAudioButton.style.display = "none";
          if (typeof window.initializeAudioEngine === "function") {
            window.initializeAudioEngine();
          }
        } catch (e) {
          console.error("Failed to start Audio Context:", e);
          alert("Could not enable audio.");
        }
      },
      { once: true }
    );
  } else {
    /* Fallback... */
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initRoom);
