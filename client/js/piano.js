// Piano interface
function initPianoInterface() {
  const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];
  const blackKeys = ["C#", "D#", "F#", "G#", "A#"];

  const container = document.getElementById("instrumentContainer");
  container.innerHTML = `
    <div class="piano-container">
      <div class="piano-keyboard">
        <div class="white-keys" id="whiteKeys"></div>
        <div class="black-keys" id="blackKeys"></div>
      </div>
      <div class="piano-controls">
        <div class="octave-control">
          <button id="octaveDown">-</button>
          <span id="currentOctave">4</span>
          <button id="octaveUp">+</button>
        </div>
      </div>
    </div>
  `;

  // Create white keys
  const whiteKeysContainer = document.getElementById("whiteKeys");
  whiteKeys.forEach((key) => {
    const keyElement = document.createElement("div");
    keyElement.className = "white-key";
    keyElement.dataset.note = key;
    keyElement.innerHTML = `<span class="key-label">${key}</span>`;
    whiteKeysContainer.appendChild(keyElement);
  });

  // Create black keys
  const blackKeysContainer = document.getElementById("blackKeys");
  blackKeys.forEach((key) => {
    const keyElement = document.createElement("div");
    keyElement.className = "black-key";
    keyElement.dataset.note = key;
    blackKeysContainer.appendChild(keyElement);
  });

  // Current octave
  let currentOctave = 4;

  // Add event listeners
  document.querySelectorAll(".white-key, .black-key").forEach((key) => {
    key.addEventListener("mousedown", () => {
      const note = key.dataset.note + currentOctave;
      playPianoNote(
        note,
        key.classList.contains("white-key") ? "white" : "black"
      );
      key.classList.add("active");
    });

    key.addEventListener("mouseup", () => {
      key.classList.remove("active");
    });

    key.addEventListener("mouseleave", () => {
      key.classList.remove("active");
    });
  });

  // Keyboard events
  const keyMap = {
    a: "C",
    w: "C#",
    s: "D",
    e: "D#",
    d: "E",
    f: "F",
    t: "F#",
    g: "G",
    y: "G#",
    h: "A",
    u: "A#",
    j: "B",
  };

  document.addEventListener("keydown", (e) => {
    if (keyMap[e.key]) {
      const note = keyMap[e.key] + currentOctave;
      const isBlackKey =
        e.key === "w" ||
        e.key === "e" ||
        e.key === "t" ||
        e.key === "y" ||
        e.key === "u";
      const keyElement = document.querySelector(
        `[data-note="${keyMap[e.key]}"]`
      );
      if (keyElement) {
        playPianoNote(note, isBlackKey ? "black" : "white");
        keyElement.classList.add("active");
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (keyMap[e.key]) {
      const keyElement = document.querySelector(
        `[data-note="${keyMap[e.key]}"]`
      );
      if (keyElement) keyElement.classList.remove("active");
    }
  });

  // Octave controls
  document.getElementById("octaveUp").addEventListener("click", () => {
    if (currentOctave < 6) {
      currentOctave++;
      document.getElementById("currentOctave").textContent = currentOctave;
    }
  });

  document.getElementById("octaveDown").addEventListener("click", () => {
    if (currentOctave > 2) {
      currentOctave--;
      document.getElementById("currentOctave").textContent = currentOctave;
    }
  });
}

function playPianoNote(note, keyType) {
  // Play sound
  audioEngine.playChord([note], "piano");

  // Send to other users
  if (roomState.socket) {
    roomState.socket.emit("audio-event", {
      type: "piano-note",
      note,
      keyType,
      timestamp: Date.now(),
    });
  }
}

// Handle incoming piano events from other users
window.handlePianoEvent = function (event) {
  // Event data should contain note: event.note
  // Play the sound received from another user
  if (event.type === "piano-note" && event.note) {
    console.log("Handling remote piano note:", event.note);
    audioEngine.playChord([event.note], "piano"); // Play the received note

    // Keep visual feedback
    const noteBase = event.note.slice(0, -1); // e.g., "C#" from "C#4"
    const keyElement = document.querySelector(`[data-note="${noteBase}"]`);
    if (keyElement) {
      keyElement.classList.add("active");
      // Adjust timeout for sound duration? Maybe not needed for piano sampler
      setTimeout(() => keyElement.classList.remove("active"), 300);
    }
  }
};
