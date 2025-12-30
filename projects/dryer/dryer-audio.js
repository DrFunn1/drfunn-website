/**
 * Dryer Audio Engine
 * Handles Web Audio synthesis and Web MIDI output
 */

class DryerAudio {
    constructor() {
        this.audioContext = null;
        this.midiOutput = null;
        this.midiEnabled = false;
        this.surfaceToNote = new Map();
        this.baseNote = 36; // C2 - good bass range for percussion
        this.isInitialized = false;
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        // Initialize Web Audio
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Try to initialize Web MIDI
        try {
            if (navigator.requestMIDIAccess) {
                const midiAccess = await navigator.requestMIDIAccess();
                this.setupMIDI(midiAccess);
            }
        } catch (e) {
            console.log('MIDI not available:', e);
        }
        
        this.isInitialized = true;
    }
    
    setupMIDI(midiAccess) {
        const outputs = Array.from(midiAccess.outputs.values());
        if (outputs.length > 0) {
            this.midiOutput = outputs[0]; // Use first MIDI output
            this.midiEnabled = true;
            console.log('MIDI output connected:', this.midiOutput.name);
        }
        
        // Listen for new MIDI devices
        midiAccess.onstatechange = (e) => {
            if (e.port.type === 'output' && e.port.state === 'connected') {
                this.midiOutput = e.port;
                this.midiEnabled = true;
                console.log('MIDI device connected:', e.port.name);
            }
        };
    }
    
    getMIDIStatus() {
        if (this.midiEnabled && this.midiOutput) {
            return `MIDI: ${this.midiOutput.name}`;
        }
        return 'MIDI: Web Audio Only';
    }
    
    assignNotesToSurfaces(surfaces) {
        this.surfaceToNote.clear();
        
        // Assign MIDI notes chromatically starting from base note
        surfaces.forEach((surface, index) => {
            const noteNumber = this.baseNote + index;
            this.surfaceToNote.set(surface.id, noteNumber);
        });
    }
    
    onCollision(surface, velocity) {
        if (!this.isInitialized) return;
        
        const noteNumber = this.surfaceToNote.get(surface.id) || this.baseNote;
        const velocityMIDI = Math.min(127, Math.floor(velocity * 300)); // Scale collision velocity to MIDI velocity
        
        // Send MIDI if available
        if (this.midiEnabled && this.midiOutput) {
            this.sendMIDINote(noteNumber, velocityMIDI);
        }
        
        // Always play through Web Audio for preview
        this.playWebAudioNote(noteNumber, velocityMIDI, surface.color);
    }
    
    sendMIDINote(noteNumber, velocity) {
        if (!this.midiOutput) return;
        
        const channel = 0; // MIDI channel 1 (0-indexed)
        const noteOn = [0x90 + channel, noteNumber, velocity];
        const noteOff = [0x80 + channel, noteNumber, 0];
        
        this.midiOutput.send(noteOn);
        
        // Send note off after 100ms
        this.midiOutput.send(noteOff, window.performance.now() + 100);
    }
    
    playWebAudioNote(noteNumber, velocity, color) {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const frequency = this.midiNoteToFrequency(noteNumber);
        const amplitude = velocity / 127 * 0.3; // Scale to reasonable volume
        
        // Create a percussive FM synthesis sound (like a drum hit)
        const duration = 0.15 + (velocity / 127) * 0.2;
        
        // Carrier oscillator
        const carrier = this.audioContext.createOscillator();
        carrier.frequency.setValueAtTime(frequency, now);
        carrier.type = 'sine';
        
        // Modulator for FM synthesis (gives it more body)
        const modulator = this.audioContext.createOscillator();
        modulator.frequency.setValueAtTime(frequency * 2, now);
        
        const modulationGain = this.audioContext.createGain();
        modulationGain.gain.setValueAtTime(frequency * 0.5, now);
        modulationGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.3);
        
        modulator.connect(modulationGain);
        modulationGain.connect(carrier.frequency);
        
        // Amplitude envelope
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(amplitude, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        // Add some noise for texture
        const noise = this.audioContext.createBufferSource();
        const noiseBuffer = this.createNoiseBuffer(duration);
        noise.buffer = noiseBuffer;
        
        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(amplitude * 0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3);
        
        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(frequency * 2, now);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.audioContext.destination);
        
        // Connect carrier to output
        carrier.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and stop
        carrier.start(now);
        modulator.start(now);
        noise.start(now);
        
        carrier.stop(now + duration);
        modulator.stop(now + duration);
        noise.stop(now + duration);
    }
    
    createNoiseBuffer(duration) {
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }
    
    midiNoteToFrequency(noteNumber) {
        // MIDI note to frequency: f = 440 * 2^((n-69)/12)
        return 440 * Math.pow(2, (noteNumber - 69) / 12);
    }
    
    async toggleMIDIOutput() {
        if (!navigator.requestMIDIAccess) {
            alert('Web MIDI API not supported in this browser');
            return false;
        }
        
        try {
            const midiAccess = await navigator.requestMIDIAccess();
            const outputs = Array.from(midiAccess.outputs.values());
            
            if (outputs.length === 0) {
                alert('No MIDI outputs detected. Please connect a MIDI device or virtual MIDI port.');
                return false;
            }
            
            // Show selection dialog if multiple outputs
            if (outputs.length > 1) {
                const selection = prompt(
                    'Select MIDI output:\n' + 
                    outputs.map((o, i) => `${i}: ${o.name}`).join('\n')
                );
                const index = parseInt(selection);
                if (index >= 0 && index < outputs.length) {
                    this.midiOutput = outputs[index];
                }
            } else {
                this.midiOutput = outputs[0];
            }
            
            this.midiEnabled = true;
            return true;
        } catch (e) {
            console.error('MIDI access error:', e);
            return false;
        }
    }
}
