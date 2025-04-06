// Drums interface
function initDrumsInterface() {
  const drumPads = [
    { id: "kick", name: "Kick", key: "1", color: "#4cc9f0" },
    { id: "snare", name: "Snare", key: "2", color: "#f72585" },
    { id: "hihat", name: "Hi-Hat", key: "3", color: "#b5179e" },
    { id: "clap", name: "Clap", key: "4", color: "#7209b7" },
    { id: "tom1", name: "Tom 1", key: "5", color: "#560bad" },
    { id: "tom2", name: "Tom 2", key: "6", color: "#480ca8" },
    { id: "ride", name: "Ride", key: "7", color: "#3a0ca3" },
    { id: "crash", name: "Crash", key: "8", color: "#3f37c9" },
    { id: "percussion", name: "Perc", key: "9", color: "#4361ee" },
  ];

  const container = document.getElementById("instrumentContainer");
  container.innerHTML = `
    <div class="drums-container">
      <div class="drums-pads" id="drumsPads"></div>
      <div class="drums-controls">
        <div class="bpm-control">
          <label>BPM:</label>
          <input type="range" id="bpmSlider" min="60" max="180" value="120">
          <span id="bpmValue">120</span>
        </div>
        <button id="metronomeBtn">Metronome: OFF</button>
      </div>
    </div>
  `;

  // Create drum pads
  const drumsPadsContainer = document.getElementById("drumsPads");
  drumPads.forEach((pad) => {
    const padElement = document.createElement("div");
    padElement.className = "drum-pad";
    padElement.dataset.sound = pad.id;
    padElement.style.backgroundColor = pad.color;
    padElement.innerHTML = `
      <div class="pad-name">${pad.name}</div>
      <div class="pad-key">${pad.key}</div>
    `;
    drumsPadsContainer.appendChild(padElement);
  });

  // Add event listeners
  document.querySelectorAll(".drum-pad").forEach((pad) => {
    pad.addEventListener("mousedown", () => {
      const sound = pad.dataset.sound;
      playDrumSound(sound);
      pad.classList.add("active");
    });

    pad.addEventListener("mouseup", () => {
      pad.classList.remove("active");
    });

    pad.addEventListener("mouseleave", () => {
      pad.classList.remove("active");
    });
  });

  // Keyboard events
  document.addEventListener("keydown", (e) => {
    const pad = drumPads.find((p) => p.key === e.key);
    if (pad) {
      const padElement = document.querySelector(`[data-sound="${pad.id}"]`);
      if (padElement) {
        playDrumSound(pad.id);
        padElement.classList.add("active");
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    const pad = drumPads.find((p) => p.key === e.key);
    if (pad) {
      const padElement = document.querySelector(`[data-sound="${pad.id}"]`);
      if (padElement) padElement.classList.remove("active");
    }
  });

  // BPM control
  const bpmSlider = document.getElementById("bpmSlider");
  const bpmValue = document.getElementById("bpmValue");
  bpmSlider.addEventListener("input", (e) => {
    const bpm = e.target.value;
    bpmValue.textContent = bpm;
    // Update any active metronome or sequencer
  });

  // Metronome control
  const metronomeBtn = document.getElementById("metronomeBtn");
  let metronomeOn = false;
  let metronomeInterval;

  metronomeBtn.addEventListener("click", () => {
    metronomeOn = !metronomeOn;
    metronomeBtn.textContent = `Metronome: ${metronomeOn ? "ON" : "OFF"}`;

    if (metronomeOn) {
      const bpm = parseInt(bpmSlider.value);
      const interval = 60000 / bpm;
      metronomeInterval = setInterval(() => {
        audioEngine.playDrumSound("kick");
      }, interval);
    } else {
      clearInterval(metronomeInterval);
    }
  });
}

function playDrumSound(sound) {
  // Play sound
  audioEngine.playDrumSound(sound);

  // Send to other users
  if (roomState.socket) {
    roomState.socket.emit("audio-event", {
      type: "drum-hit",
      sound,
      timestamp: Date.now(),
    });
  }
}

// Handle incoming drum events from other users
window.handleDrumEvent = function (event) {
  // Event data should contain sound ID: event.sound
  // Play the sound received from another user
  if (event.type === "drum-hit" && event.sound) {
    console.log("Handling remote drum hit:", event.sound);
    audioEngine.playDrumSound(event.sound); // Play the received drum sound

    // Keep visual feedback
    const padElement = document.querySelector(`[data-sound="${event.sound}"]`);
    if (padElement) {
      padElement.classList.add("active");
      setTimeout(() => padElement.classList.remove("active"), 100);
    }
  }
};
