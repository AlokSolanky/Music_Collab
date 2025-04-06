// Global state
const appState = {
  selectedInstrument: null,
  socket: null,
  currentRoom: null,
};

// DOM elements
const elements = {
  instrumentsGrid: document.getElementById("instrumentsGrid"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomIdInput: document.getElementById("roomIdInput"),
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
    });
  });

  // Room ID input
  elements.roomIdInput.addEventListener("input", (e) => {
    elements.joinRoomBtn.disabled = !(
      e.target.value && appState.selectedInstrument
    );
  });

  // Create room button
  elements.createRoomBtn.addEventListener("click", createRoom);

  // Join room button
  elements.joinRoomBtn.addEventListener("click", joinRoom);
}

// Connect to Socket.io server
function connectSocket() {
  appState.socket = io("http://localhost:3001");
}

// Create a new room
function createRoom() {
  if (!appState.selectedInstrument) return;

  appState.socket.emit("create-room", appState.selectedInstrument);

  appState.socket.on("room-created", (room) => {
    appState.currentRoom = room;
    window.location.href = `room.html?roomId=${room.id}&instrument=${appState.selectedInstrument}`;
  });
}

// Join an existing room
function joinRoom() {
  const roomId = elements.roomIdInput.value.trim();
  if (!roomId || !appState.selectedInstrument) return;

  appState.socket.emit("join-room", {
    roomId,
    instrument: appState.selectedInstrument,
  });

  appState.socket.on("room-joined", (room) => {
    appState.currentRoom = room;
    window.location.href = `room.html?roomId=${room.id}&instrument=${appState.selectedInstrument}`;
  });

  appState.socket.on("error", (message) => {
    alert(message);
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);
