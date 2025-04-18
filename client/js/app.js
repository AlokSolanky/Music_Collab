// Global state
const appState = {
  selectedInstrument: null,
  socket: null,
  // Remove currentRoom and userId, not needed here anymore
};

// DOM elements
const elements = {
  instrumentsGrid: document.getElementById("instrumentsGrid"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomIdInput: document.getElementById("roomIdInput"),
  errorMessage: document.getElementById("errorMessage"),
};

// Instruments data
const instruments = [
  { id: "guitar", name: "Guitar", icon: "🎸" },
  { id: "piano", name: "Piano", icon: "🎹" },
  { id: "drums", name: "Drums", icon: "🥁" },
  { id: "vocal", name: "Vocal", icon: "🎤" },
];

// Initialize the app
function initApp() {
  renderInstruments();
  setupEventListeners();
  connectSocket(); // Connect socket once on load
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
      clearError();
    });
  });

  // Room ID input
  elements.roomIdInput.addEventListener("input", (e) => {
    elements.joinRoomBtn.disabled = !(
      e.target.value && appState.selectedInstrument
    );
    clearError();
  });

  // Create room button
  elements.createRoomBtn.addEventListener("click", handleCreateRoomRequest);

  // Join room button
  elements.joinRoomBtn.addEventListener("click", handleJoinRoomRequest);
}

// Connect to Socket.io server (only once)
function connectSocket() {
  if (!appState.socket) {
    // *** MODIFIED LINE HERE ***
    // Replace "YOUR_SERVER_LOCAL_IP" with the actual IP of the machine running the server
    const SERVER_URL = "http://192.168.1.45:3001";
    // Example: const SERVER_URL = "http://192.168.1.100:3001";

    console.log(`Attempting to connect to server at ${SERVER_URL}`); // Log the URL being used
    appState.socket = io(SERVER_URL); // Use the server's local IP

    // Centralized listener for errors from server requests on this page
    appState.socket.on("error", (message) => {
      console.error("Server error:", message);
      showError(message);
    });

    // Listeners for Server Responses
    appState.socket.on("room-id-created", ({ roomId }) => {
      console.log("Received room-id-created:", roomId);
      if (roomId) {
        window.location.href = `room.html?action=create&roomId=${roomId}&instrument=${appState.selectedInstrument}`;
      } else {
        showError("Failed to get Room ID from server.");
      }
    });
    appState.socket.on("join-validated", ({ success, roomId, message }) => {
      console.log("Received join-validated:", { success, roomId, message });
      if (success) {
        window.location.href = `room.html?action=join&roomId=${roomId}&instrument=${appState.selectedInstrument}`;
      } else {
        showError(message || "Failed to validate room.");
      }
    });

    // Handle connection errors
    appState.socket.on("connect_error", (err) => {
      console.error(`Connection failed to ${SERVER_URL}:`, err.message);
      showError(
        `Cannot connect to the server at ${SERVER_URL}. Ensure it's running and check the IP address.`
      );
    });

    appState.socket.on("connect", () => {
      console.log(`Successfully connected to server at ${SERVER_URL}`);
    });
  }
}

// --- Request Functions ---

// Request the server to generate a room ID
function handleCreateRoomRequest() {
  if (!appState.selectedInstrument) {
    showError("Please select an instrument first.");
    return;
  }
  if (!appState.socket || !appState.socket.connected) {
    showError("Not connected to server.");
    return;
  }
  clearError();
  console.log("Emitting create-room-request");
  // Send only the instrument, server will generate ID
  appState.socket.emit("create-room-request", appState.selectedInstrument);
}

// Request the server to validate joining an existing room
function handleJoinRoomRequest() {
  const roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!roomId) {
    showError("Please enter a Room ID.");
    return;
  }
  if (!appState.selectedInstrument) {
    showError("Please select an instrument first.");
    return;
  }
  if (!appState.socket || !appState.socket.connected) {
    showError("Not connected to server.");
    return;
  }
  clearError();
  console.log("Emitting validate-join-request for room:", roomId);
  appState.socket.emit("validate-join-request", {
    roomId,
    instrument: appState.selectedInstrument,
  });
}

// --- Error Display ---
function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = "block";
  } else {
    alert(message);
  }
}

function clearError() {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = "";
    elements.errorMessage.style.display = "none";
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);
