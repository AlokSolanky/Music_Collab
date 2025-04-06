// Audio engine using Tone.js
const audioEngine = {
  synths: {},
  samples: {},
  effects: {},
  masterVolume: new Tone.Volume(-5).toDestination(),

  init() {
    // Initialize synths and samples for all instruments
    this.initGuitar();
    this.initPiano();
    this.initDrums();
    this.initVocals();

    console.log("Audio engine initialized");
  },

  initGuitar() {
    this.synths.guitar = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "fatsawtooth",
        count: 3,
        spread: 30,
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.5,
        release: 0.4,
      },
    }).connect(this.masterVolume);
  },

  initPiano() {
    this.synths.piano = new Tone.Sampler({
      urls: {
        C4: "C4.mp3",
      },
      release: 1,
      baseUrl: "assets/sounds/piano/",
    }).connect(this.masterVolume);
  },

  initDrums() {
    // Define paths to your drum samples - MAKE SURE FILENAMES/EXTENSIONS MATCH YOUR FILES
    const drumSampleFiles = {
      kick: "kick.wav",
      snare: "snare.wav",
      hihat: "hihat.wav", // Or maybe separate open/closed hihats
      clap: "clap.wav",
      tom1: "tom.wav",
      tom2: "tink.wav",
      ride: "ride.wav",
      crash: "boom.wav",
      percussion: "openhat.wav", // Example name
    };

    this.samples.drums = {}; // Initialize as empty object

    // Create and load a Tone.Player for each drum sound
    for (const soundId in drumSampleFiles) {
      const filePath = `assets/sounds/drums/${drumSampleFiles[soundId]}`;
      this.samples.drums[soundId] = new Tone.Player(filePath).connect(
        this.masterVolume
      );
      // Optional: Add error handling for loading
      this.samples.drums[soundId].load().catch((err) => {
        console.error(`Failed to load drum sample: ${filePath}`, err);
        alert(
          `Error loading drum sound: ${soundId}. Check asset path and filename.`
        );
      });
      console.log(`Loading drum sample: ${filePath}`);
    }
    console.log("Drum samples loading initiated.");
  },

  initVocals() {
    // Vocal effects chain
    this.effects.vocalReverb = new Tone.Reverb(2.5).toDestination();
    this.effects.vocalDelay = new Tone.FeedbackDelay("8n", 0.3).toDestination();
    this.effects.vocalPitch = new Tone.PitchShift().toDestination();

    // Set initial wet/dry mix for effects
    this.effects.vocalReverb.wet.value = 0.4;
    this.effects.vocalDelay.wet.value = 0.2;
    this.effects.vocalPitch.pitch = 0;

    // Vocal input will be connected through the vocal interface
    this.synths.vocal = new Tone.Volume(-10); // Base vocal volume
  },

  playChord(notes, instrument = "guitar", duration = "8n") {
    if (this.synths[instrument]) {
      this.synths[instrument].triggerAttackRelease(notes, duration);
    }
  },

  playNote(note, instrument = "piano", duration = "8n") {
    if (this.synths[instrument]) {
      this.synths[instrument].triggerAttackRelease(note, duration);
    }
  },

  playDrumSound(sound) {
    if (this.samples.drums && this.samples.drums[sound]) {
      this.samples.drums[sound].start();
    }
  },

  setVolume(volume, instrument = "master") {
    if (instrument === "master") {
      this.masterVolume.volume.value = volume;
    } else if (this.synths[instrument]) {
      this.synths[instrument].volume.value = volume;
    }
  },

  connectVocalSource(sourceNode) {
    // Connect microphone or other vocal source through effects chain
    sourceNode.chain(
      this.effects.vocalPitch,
      this.effects.vocalDelay,
      this.effects.vocalReverb,
      this.masterVolume
    );
  },

  updateVocalEffect(effect, value) {
    switch (effect) {
      case "reverb":
        this.effects.vocalReverb.wet.value = value;
        break;
      case "delay":
        this.effects.vocalDelay.wet.value = value;
        break;
      case "pitch":
        this.effects.vocalPitch.pitch = value;
        break;
    }
  },
};

// Initialize when loaded
document.addEventListener("DOMContentLoaded", () => {
  audioEngine.init();
});
