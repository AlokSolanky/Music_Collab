// Global state
const appState = {
  selectedInstrument: null,
  socket: null,
  currentRoom: null,
  userId: null, // Added userId state
};

// DOM elements
const elements = {
  instrumentsGrid: document.getElementById("instrumentsGrid"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomIdInput: document.getElementById("roomIdInput"),
  errorMessage: document.getElementById("errorMessage"), // Assuming you have an element with this ID for errors
};

// Instruments data
const instruments = [
  { id: "guitar", name: "Guitar", icon: "🎸" }, // Corrected icons
  { id: "piano", name: "Piano", icon: "🎹" },
  { id: "drums", name: "Drums", icon: "🥁" },
  { id: "vocal", name: "Vocal", icon: "🎤" },
];

// Initialize the app
function initApp() {
  renderInstruments();
  setupEventListeners();
  connectSocket();
}

// Render instrument selection
function renderInstruments() {
  elements.instrumentsGrid.innerHTML = instruments
    .map(
      (instrument) => `
    <div class="instrument-card" data-instrument="${instrument.id}">
      <div class="instrument-icon">${instrument.icon}</div>
      <div class="instrument-name">${instrument.name}</div>
    </div>
  `
    )
    .join("");
}

// Setup event listeners
function setupEventListeners() {
  // Instrument selection
  document.querySelectorAll(".instrument-card").forEach((card) => {
    card.addEventListener("click", () => {
      document
        .querySelectorAll(".instrument-card")
        .forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      appState.selectedInstrument = card.dataset.instrument;
      elements.createRoomBtn.disabled = false;
      elements.joinRoomBtn.disabled = !elements.roomIdInput.value;
      clearError(); // Clear errors on new selection
    });
  });

  // Room ID input
  elements.roomIdInput.addEventListener("input", (e) => {
    elements.joinRoomBtn.disabled = !(
      e.target.value && appState.selectedInstrument
    );
    clearError(); // Clear errors on input change
  });

  // Create room button
  elements.createRoomBtn.addEventListener("click", createRoom);

  // Join room button
  elements.joinRoomBtn.addEventListener("click", joinRoom);
}

// Connect to Socket.io server
function connectSocket() {
  // Ensure connection is only established once
  if (!appState.socket) {
    appState.socket = io("http://localhost:3001"); // Make sure this URL matches your server

    // --- Centralized Error Handling ---
    appState.socket.on("error", (message) => {
      console.error("Server error:", message);
      showError(message); // Display error to the user
    });

    // --- Listeners for room creation/join confirmation ---
    // Moved from createRoom/joinRoom functions to ensure they are set up only once

    appState.socket.on("room-created", ({ room, userId }) => {
      // Destructure room and userId
      console.log("Room created:", room, "User ID:", userId);
      appState.currentRoom = room;
      appState.userId = userId;
      // Store userId for the next page (room.html)
      sessionStorage.setItem("userId", userId);
      window.location.href = `room.html?roomId=${room.id}&instrument=${appState.selectedInstrument}`;
    });

    appState.socket.on("room-joined", ({ room, userId }) => {
      // Destructure room and userId
      console.log("Room joined:", room, "User ID:", userId);
      appState.currentRoom = room;
      appState.userId = userId;
      // Store userId for the next page (room.html)
      sessionStorage.setItem("userId", userId);
      window.location.href = `room.html?roomId=${room.id}&instrument=${appState.selectedInstrument}`;
    });

    // Handle connection errors
    appState.socket.on("connect_error", (err) => {
      console.error("Connection failed:", err.message);
      showError("Cannot connect to the server. Please ensure it's running.");
    });
  }
}

// Create a new room
function createRoom() {
  if (!appState.selectedInstrument) {
    showError("Please select an instrument first.");
    return;
  }
  if (!appState.socket || !appState.socket.connected) {
    showError("Not connected to server. Please wait or refresh.");
    return;
  }
  clearError();
  console.log(
    "Emitting create-room with instrument:",
    appState.selectedInstrument
  );
  appState.socket.emit("create-room", appState.selectedInstrument);
}

// Join an existing room
function joinRoom() {
  const roomId = elements.roomIdInput.value.trim().toUpperCase(); // Match server generation
  if (!roomId) {
    showError("Please enter a Room ID.");
    return;
  }
  if (!appState.selectedInstrument) {
    showError("Please select an instrument first.");
    return;
  }
  if (!appState.socket || !appState.socket.connected) {
    showError("Not connected to server. Please wait or refresh.");
    return;
  }
  clearError();
  console.log("Emitting join-room with:", {
    roomId,
    instrument: appState.selectedInstrument,
  });
  appState.socket.emit("join-room", {
    roomId,
    instrument: appState.selectedInstrument,
  });
}

// --- Error Display ---
function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = "block"; // Or manage visibility via CSS classes
  } else {
    alert(message); // Fallback if error element doesn't exist
  }
}

function clearError() {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = "";
    elements.errorMessage.style.display = "none"; // Or manage visibility via CSS classes
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);
