// Vocal interface
function initVocalInterface() {
  const container = document.getElementById("instrumentContainer");
  container.innerHTML = `
    <div class="vocal-container">
      <div class="mic-visualizer" id="micVisualizer">
        <div class="mic-icon">🎤</div>
        <div class="visualizer-bars" id="visualizerBars"></div>
      </div>
      
      <div class="vocal-controls">
        <button id="micToggleBtn" class="mic-button">Enable Microphone</button>
        
        <div class="effects-controls">
          <div class="effect">
            <label>Reverb</label>
            <input type="range" id="reverbSlider" min="0" max="1" step="0.1" value="0.4">
          </div>
          
          <div class="effect">
            <label>Delay</label>
            <input type="range" id="delaySlider" min="0" max="1" step="0.1" value="0.2">
          </div>
          
          <div class="effect">
            <label>Pitch</label>
            <input type="range" id="pitchSlider" min="-12" max="12" step="1" value="0">
          </div>
        </div>
      </div>
    </div>
  `;

  // Create visualizer bars
  const visualizerBars = document.getElementById("visualizerBars");
  for (let i = 0; i < 10; i++) {
    const bar = document.createElement("div");
    bar.className = "visualizer-bar";
    visualizerBars.appendChild(bar);
  }

  // Audio setup
  let mic = null;
  let analyser = null;
  let reverb = null;
  let delay = null;
  let pitchShift = null;
  let isMicOn = false;
  const micToggleBtn = document.getElementById("micToggleBtn");

  // Initialize effects
  function initEffects() {
    reverb = new Tone.Reverb(2).toDestination();
    delay = new Tone.FeedbackDelay("8n", 0.2).toDestination();
    pitchShift = new Tone.PitchShift().toDestination();

    // Set initial values
    reverb.wet.value = document.getElementById("reverbSlider").value;
    delay.wet.value = document.getElementById("delaySlider").value;
    pitchShift.pitch = document.getElementById("pitchSlider").value;
  }

  // Setup microphone
  async function setupMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic = new Tone.UserMedia();
      analyser = new Tone.Analyser("waveform", 32);

      initEffects();

      mic.open().then(() => {
        // Connect mic to effects chain
        mic.chain(pitchShift, delay, reverb, Tone.Destination);
        mic.connect(analyser);

        isMicOn = true;
        micToggleBtn.textContent = "Disable Microphone";

        // Start visualization
        visualize();
      });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }

  // Visualize microphone input
  function visualize() {
    if (!isMicOn) return;

    requestAnimationFrame(visualize);

    const values = analyser.getValue();
    const bars = document.querySelectorAll(".visualizer-bar");

    bars.forEach((bar, i) => {
      const value = Math.abs(values[i] || 0);
      const height = `${value * 100}%`;
      bar.style.height = height;
      bar.style.backgroundColor = `hsl(${200 + value * 60}, 100%, 50%)`;
    });
  }

  // Toggle microphone
  micToggleBtn.addEventListener("click", () => {
    if (isMicOn) {
      if (mic) mic.close();
      isMicOn = false;
      micToggleBtn.textContent = "Enable Microphone";

      // Reset visualizer
      document.querySelectorAll(".visualizer-bar").forEach((bar) => {
        bar.style.height = "0%";
      });
    } else {
      setupMicrophone();
    }
  });

  // Effect controls
  document.getElementById("reverbSlider").addEventListener("input", (e) => {
    if (reverb) reverb.wet.value = e.target.value;
  });

  document.getElementById("delaySlider").addEventListener("input", (e) => {
    if (delay) delay.wet.value = e.target.value;
  });

  document.getElementById("pitchSlider").addEventListener("input", (e) => {
    if (pitchShift) pitchShift.pitch = e.target.value;
  });

  // Send vocal data to other users (simplified - would use WebRTC in real app)
  setInterval(() => {
    if (isMicOn && roomState.socket) {
      roomState.socket.emit("audio-event", {
        type: "vocal-data",
        // In a real app, we'd send actual audio data
        timestamp: Date.now(),
      });
    }
  }, 100);
}

// Handle incoming vocal events from other users
window.playRemoteVocalSound = function (event) {
  if (event.type === "vocal-data") {
    // In a real app, we'd process the incoming audio data
    const visualizer = document.getElementById("micVisualizer");
    if (visualizer) {
      visualizer.classList.add("active");
      setTimeout(() => visualizer.classList.remove("active"), 100);
    }
  }
};
