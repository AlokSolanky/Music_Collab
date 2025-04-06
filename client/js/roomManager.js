// Global state for room page
const roomState = {
  socket: null,
  currentRoom: null,
  users: [],
  instrument: null,
  isHost: false,
};

// Initialize room page
function initRoom() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("roomId");
  const instrument = params.get("instrument");

  if (!roomId || !instrument) {
    window.location.href = "index.html";
    return;
  }

  roomState.instrument = instrument;
  document.title = `${
    instrument.charAt(0).toUpperCase() + instrument.slice(1)
  } - Room ${roomId}`;

  loadInstrumentInterface(instrument);
  connectRoomSocket(roomId, instrument);
  setupAudio();
}

// Load the appropriate instrument interface
function loadInstrumentInterface(instrument) {
  const instrumentContainer = document.getElementById("instrumentContainer");

  // Load CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `css/${instrument}.css`;
  document.head.appendChild(link);

  // Load JS
  const script = document.createElement("script");
  script.src = `js/${instrument}.js`;
  script.onload = () => {
    // Initialize instrument interface
    if (
      window[
        `init${
          instrument.charAt(0).toUpperCase() + instrument.slice(1)
        }Interface`
      ]
    ) {
      window[
        `init${
          instrument.charAt(0).toUpperCase() + instrument.slice(1)
        }Interface`
      ]();
    }
  };
  document.body.appendChild(script);
}

// Connect to room via Socket.io
function connectRoomSocket(roomId, instrument) {
  roomState.socket = io("http://localhost:3001");

  // Check if we're the host (creator) of the room
  const isHost = !sessionStorage.getItem("hasJoinedRoom");
  if (!isHost) {
    roomState.socket.emit("join-room", { roomId, instrument });
    sessionStorage.setItem("hasJoinedRoom", "true");
  }

  // Room created (for host)
  roomState.socket.on("room-created", (room) => {
    roomState.currentRoom = room;
    roomState.isHost = true;
    updateRoomUI(room);
  });

  // Room joined (for guests)
  roomState.socket.on("room-joined", (room) => {
    roomState.currentRoom = room;
    roomState.users = room.users;
    updateRoomUI(room);
  });

  // User joined
  roomState.socket.on("user-joined", (user) => {
    roomState.users.push(user);
    updateUsersList();
  });

  // User left
  roomState.socket.on("user-left", (userId) => {
    roomState.users = roomState.users.filter((u) => u.id !== userId);
    updateUsersList();
  });

  // Audio events from other users
  roomState.socket.on("audio-event", (event) => {
    handleIncomingAudioEvent(event);
  });
}

// Update room information in UI
function updateRoomUI(room) {
  document.getElementById("roomIdDisplay").textContent = `Room: ${room.id}`;
  document.getElementById(
    "playerCount"
  ).textContent = `Players: ${room.users.length}/4`;
  updateUsersList();
}

// Update users list
function updateUsersList() {
  const usersList = document.getElementById("usersList");
  usersList.innerHTML = roomState.users
    .map(
      (user) => `
    <div class="user-item">
      <div class="user-icon">${getInstrumentIcon(user.instrument)}</div>
      <div class="user-name">${user.instrument}</div>
    </div>
  `
    )
    .join("");
}

// Handle incoming audio events
function handleIncomingAudioEvent(event) {
  if (
    window[
      `handle${
        event.type.charAt(0).toUpperCase() +
        event.type.slice(1).replace("-", "")
      }Event`
    ]
  ) {
    window[
      `handle${
        event.type.charAt(0).toUpperCase() +
        event.type.slice(1).replace("-", "")
      }Event`
    ](event);
  }
}

// Get instrument icon
function getInstrumentIcon(instrument) {
  const icons = {
    guitar: "🎸",
    piano: "🎹",
    drums: "🥁",
    vocal: "🎤",
  };
  return icons[instrument] || "🎵";
}

// Setup audio context
function setupAudio() {
  document.addEventListener(
    "click",
    () => {
      Tone.start();
      console.log("Audio is ready");
    },
    { once: true }
  );
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initRoom);
