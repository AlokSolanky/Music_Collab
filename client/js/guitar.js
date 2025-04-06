// Guitar interface
function initGuitarInterface() {
  const chords = [
    { name: "C", notes: ["C4", "E4", "G4"] },
    { name: "G", notes: ["G3", "B3", "D4"] },
    { name: "D", notes: ["D3", "F#3", "A3"] },
    { name: "A", notes: ["A3", "C#4", "E4"] },
    { name: "E", notes: ["E3", "G#3", "B3"] },
    { name: "F", notes: ["F3", "A3", "C4"] },
    { name: "Am", notes: ["A3", "C4", "E4"] },
    { name: "Em", notes: ["E3", "G3", "B3"] },
    { name: "Dm", notes: ["D3", "F3", "A3"] },
    { name: "B7", notes: ["B3", "D#4", "F#4", "A4"] },
  ];

  const container = document.getElementById("instrumentContainer");
  container.innerHTML = `
    <div class="guitar-container">
      <img src="assets/images/guitar.png" alt="Guitar" class="guitar-image" id="guitarImage">
      
      <div class="chords-grid" id="chordsGrid">
        ${chords
          .map(
            (chord, index) => `
          <div class="chord-button" data-chord="${chord.name}" data-index="${index}">
            <div class="chord-name">${chord.name}</div>
            <div class="shortcut">${index}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  // Add event listeners
  document.querySelectorAll(".chord-button").forEach((button) => {
    button.addEventListener("click", () => {
      const chordName = button.dataset.chord;
      const chord = chords.find((c) => c.name === chordName);
      playGuitarChord(chord);
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const index = parseInt(e.key);
    if (!isNaN(index)) {
      const button = document.querySelector(
        `.chord-button[data-index="${index}"]`
      );
      if (button) {
        button.click();
        button.classList.add("active");
        setTimeout(() => button.classList.remove("active"), 300);
      }
    }
  });
}

function playGuitarChord(chord) {
  // Visual feedback
  const guitarImage = document.getElementById("guitarImage");
  guitarImage.classList.add("strumming");
  setTimeout(() => guitarImage.classList.remove("strumming"), 300);

  // Play sound
  audioEngine.playChord(chord.notes, "guitar");

  // Send to other users
  if (roomState.socket) {
    roomState.socket.emit("audio-event", {
      type: "chord",
      chord: chord.name,
      notes: chord.notes,
      timestamp: Date.now(),
    });
  }
}

// Handle incoming guitar events from other users
window.handleChordEvent = function (event) {
  if (event.type === "chord") {
    // Visual feedback only (since audio is handled by sender)
    const guitarImage = document.getElementById("guitarImage");
    if (guitarImage) {
      guitarImage.classList.add("strumming");
      setTimeout(() => guitarImage.classList.remove("strumming"), 300);
    }
  }
};
