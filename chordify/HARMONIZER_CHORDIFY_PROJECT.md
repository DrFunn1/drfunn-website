# Harmonizer / Chordify Project - Summary for New Chat

## Context from Dryer Beta Testing

During beta testing of the Dryer percussion generator, an artist requested:
> "Single MIDI note triggers playing of a chord"

This feature is outside Dryer's scope (physics-based percussion generation), but represents an interesting standalone project opportunity.

---

## Project Concepts

### Option 1: "Harmonizer" - Web MIDI Tool

**Purpose:** Take single MIDI notes from any source and output chords

**Target Users:**
- Musicians using Dryer or other MIDI generators
- Live performers wanting quick chord harmonization
- Educational tool for learning music theory

**Core Features:**
- MIDI input listener (Web MIDI API)
- Chord type selector (major, minor, dom7, maj7, diminished, augmented, sus2, sus4, etc.)
- Inversion control
- Octave spread
- MIDI output to DAW/synth

**Tech Stack:**
- Vanilla JavaScript + Web MIDI API (same as Dryer)
- Simple UI matching DrFunn aesthetic
- ~200-300 lines of code total

**URL:** `drfunn.com/projects/harmonizer`

**Unique Angle:**
- Visual chord theory education
- Real-time MIDI processing in browser
- No installation needed
- Pairs perfectly with Dryer

---

### Option 2: "Chordify" - Eurorack Hardware Module

**Purpose:** Hardware MIDI/CV chord generator for eurorack systems

**Market Gap:**
- Existing solutions are expensive ($300+) or complex
- Simple, affordable chord generator doesn't exist
- Perfect companion to physical Dryer module (future product)

**Core Features:**
- MIDI in → MIDI out (with chord harmonization)
- OR: Single CV/Gate in → 4x CV/Gate out (polyphonic)
- Physical knob: Chord type selection
- Physical knob: Voicing/inversion
- CV control inputs for both parameters
- LED display for chord name

**Size:** 4-6HP (small, affordable)

**Price Target:** $120-150

**Technical:**
- Microcontroller (Teensy 4.0 or similar)
- MIDI I/O + CV I/O
- DAC for CV outputs
- Simple display (OLED)

**Manufacturing:**
- PCB design in KiCad
- Panel design (could be fun DrFunn branding)
- Small batch manufacturing (~50-100 units)

---

## Why This is a Good DrFunn Project

1. **Complements Dryer:** Transforms rhythm into harmony
2. **Educational:** Teaches chord theory interactively
3. **Market Need:** No good affordable options exist
4. **Portfolio Diversity:** Shows MIDI processing + music theory knowledge
5. **Potential Revenue:** Hardware module could actually sell

---

## Implementation Priority

### Phase 1: Web Tool (Quick Win)
- Build simple web harmonizer
- Test with Dryer beta testers
- Get feedback on chord types needed
- Timeline: 1-2 days of development

### Phase 2: Enhanced Web Version
- Add arpeggiator mode
- Add chord progression builder
- Add scale/key awareness
- Educational tooltips
- Timeline: 1 week

### Phase 3: Eurorack Module (Big Project)
- Circuit design
- Firmware development
- Panel design
- Prototype testing
- Small batch manufacturing
- Timeline: 3-6 months

---

## Questions to Explore in New Chat

1. **Web Version:**
   - What chord types are most useful for electronic music?
   - Should it include chord progressions (ii-V-I, etc.)?
   - Arpeggiator mode?
   - MIDI learn for mapping controls?

2. **Hardware Version:**
   - MIDI-only or MIDI + CV?
   - How many simultaneous voices?
   - Integration with other eurorack standards?
   - Manufacturing partners?

3. **Business:**
   - Open source web tool, commercial hardware?
   - Pricing strategy?
   - Target market research?

---

## Reference Materials to Review

- Web MIDI API documentation
- Music theory: chord construction, inversions, voicings
- Existing eurorack chord generators (Disting EX, Polyend Poly 2)
- MIDI specification for note messages
- Eurorack standards (voltage ranges, gate standards)

---

## Beta Tester's Original Context

Artist wanted to use Dryer's chaotic MIDI output to trigger chords on a synth, creating harmonic complexity from rhythmic chaos. This is a brilliant use case that many experimental musicians would appreciate.

---

## Next Steps for New Chat

1. Decide: Web tool first, or jump to hardware?
2. Define MVP feature set
3. Design UI/UX (web) or circuit schematic (hardware)
4. Prototype and test
5. Iterate based on feedback

This could become a signature DrFunn project - a bridge between rhythm and harmony!
