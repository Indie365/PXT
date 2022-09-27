namespace pxt.assets.music {
    export interface Instrument {
        waveform: number;
        ampEnvelope: Envelope;
        pitchEnvelope?: Envelope;
        ampLFO?: LFO;
        pitchLFO?: LFO;
    }

    export interface Envelope {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
        amplitude: number;
    }

    export interface LFO {
        frequency: number;
        amplitude: number;
    }

    export interface Song {
        measures: number;
        beatsPerMeasure: number;
        beatsPerMinute: number;
        ticksPerBeat: number;
        tracks: Track[];
    }

    export interface Track {
        instrument: Instrument;
        drums?: DrumInstrument[];
        notes: NoteEvent[];
    }

    export interface NoteEvent {
        notes: number[];
        startTick: number;
        endTick: number;
    }

    export interface DrumSoundStep {
        waveform: number;
        frequency: number;
        volume: number;
        duration: number;
    }

    export interface DrumInstrument {
        startFrequency: number;
        startVolume: number;
        steps: DrumSoundStep[];
    }

    const BUFFER_SIZE = 12;

    export function renderInstrument(instrument: Instrument, noteFrequency: number, gateLength: number, volume: number) {
        const totalDuration = gateLength + instrument.ampEnvelope.release;

        const ampLFOInterval = instrument.ampLFO?.amplitude ? Math.max(500 / instrument.ampLFO.frequency, 50) : 50;
        const pitchLFOInterval = instrument.pitchLFO?.amplitude ? Math.max(500 / instrument.pitchLFO.frequency, 50) : 50;

        let timePoints = [0];

        let nextAETime = instrument.ampEnvelope.attack;
        let nextPETime = instrument.pitchEnvelope?.amplitude ? instrument.pitchEnvelope.attack : totalDuration;
        let nextPLTime = instrument.pitchLFO?.amplitude ? pitchLFOInterval : totalDuration;
        let nextALTime = instrument.ampLFO?.amplitude ? ampLFOInterval : totalDuration;

        let time = 0;
        while (time < totalDuration) {
            if (nextAETime <= nextPETime && nextAETime <= nextPLTime && nextAETime <= nextALTime) {
                time = nextAETime;
                timePoints.push(nextAETime);

                if (time < instrument.ampEnvelope.attack + instrument.ampEnvelope.decay && instrument.ampEnvelope.attack + instrument.ampEnvelope.decay < gateLength) {
                    nextAETime = instrument.ampEnvelope.attack + instrument.ampEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextAETime = gateLength;
                }
                else {
                    nextAETime = totalDuration;
                }
            }
            else if (nextPETime <= nextPLTime && nextPETime <= nextALTime && nextPETime < totalDuration) {
                time = nextPETime;
                timePoints.push(nextPETime);
                if (time < instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay && instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay < gateLength) {
                    nextPETime = instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextPETime = gateLength;
                }
                else if (time < gateLength + instrument.pitchEnvelope.release) {
                    nextPETime = Math.min(totalDuration, gateLength + instrument.pitchEnvelope.release);
                }
                else {
                    nextPETime = totalDuration
                }
            }
            else if (nextPLTime <= nextALTime && nextPLTime < totalDuration) {
                time = nextPLTime;
                timePoints.push(nextPLTime);
                nextPLTime += pitchLFOInterval;
            }
            else if (nextALTime < totalDuration) {
                time = nextALTime;
                timePoints.push(nextALTime);
                nextALTime += ampLFOInterval;
            }


            if (time >= totalDuration) {
                break;
            }

            if (nextAETime <= time) {
                if (time < instrument.ampEnvelope.attack + instrument.ampEnvelope.decay && instrument.ampEnvelope.attack + instrument.ampEnvelope.decay < gateLength) {
                    nextAETime = instrument.ampEnvelope.attack + instrument.ampEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextAETime = gateLength;
                }
                else {
                    nextAETime = totalDuration;
                }
            }
            if (nextPETime <= time) {
                if (time < instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay && instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay < gateLength) {
                    nextPETime = instrument.pitchEnvelope.attack + instrument.pitchEnvelope.decay;
                }
                else if (time < gateLength) {
                    nextPETime = gateLength;
                }
                else if (time < gateLength + instrument.pitchEnvelope.release) {
                    nextPETime = Math.min(totalDuration, gateLength + instrument.pitchEnvelope.release);
                }
                else {
                    nextPETime = totalDuration
                }
            }
            while (nextALTime <= time) {
                nextALTime += ampLFOInterval;
            }
            while (nextPLTime <= time) {
                nextPLTime += pitchLFOInterval;
            }
        }


        let prevAmp = instrumentVolumeAtTime(instrument, gateLength, 0, volume) | 0;
        let prevPitch = instrumentPitchAtTime(instrument, noteFrequency, gateLength, 0) | 0;
        let prevTime = 0;

        let nextAmp: number;
        let nextPitch: number;
        const out = new Uint8Array(BUFFER_SIZE * (timePoints.length + 1));
        for (let i = 1; i < timePoints.length; i++) {
            if (timePoints[i] - prevTime < 5) {
                prevTime = timePoints[i];
                continue;
            }

            nextAmp = instrumentVolumeAtTime(instrument, gateLength, timePoints[i], volume) | 0;
            nextPitch = instrumentPitchAtTime(instrument, noteFrequency, gateLength, timePoints[i]) | 0
            addNote(
                out,
                (i - 1) * 12,
                (timePoints[i] - prevTime) | 0,
                prevAmp,
                nextAmp,
                instrument.waveform,
                prevPitch,
                nextPitch
            )

            prevAmp = nextAmp;
            prevPitch = nextPitch;
            prevTime = timePoints[i];
        }
        addNote(
            out,
            timePoints.length * 12,
            10,
            prevAmp,
            0,
            instrument.waveform,
            prevPitch,
            prevPitch
        )
        return out;
    }

    export function renderDrumInstrument(sound: DrumInstrument, volume: number) {
        let prevAmp = sound.startVolume;
        let prevFreq = sound.startFrequency;

        const scaleVolume = (value: number) => (value / 1024) * volume;

        let out = new Uint8Array((sound.steps.length + 1) * BUFFER_SIZE);

        for (let i = 0; i < sound.steps.length; i++) {
            addNote(
                out,
                i * BUFFER_SIZE,
                sound.steps[i].duration,
                scaleVolume(prevAmp),
                scaleVolume(sound.steps[i].volume),
                sound.steps[i].waveform,
                prevFreq,
                sound.steps[i].frequency
            );
            prevAmp = sound.steps[i].volume;
            prevFreq = sound.steps[i].frequency
        }

        addNote(
            out,
            sound.steps.length * BUFFER_SIZE,
            10,
            scaleVolume(prevAmp),
            0,
            sound.steps[sound.steps.length - 1].waveform,
            prevFreq,
            prevFreq
        );

        return out;
    }

    function instrumentPitchAtTime(instrument: Instrument, noteFrequency: number, gateLength: number, time: number) {
        let mod = 0;
        if (instrument.pitchEnvelope?.amplitude) {
            mod += envelopeValueAtTime(instrument.pitchEnvelope, time, gateLength)
        }
        if (instrument.pitchLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.pitchLFO, time)
        }
        return Math.max(noteFrequency + mod, 0);
    }

    function instrumentVolumeAtTime(instrument: Instrument, gateLength: number, time: number, maxVolume: number) {
        let mod = 0;
        if (instrument.ampEnvelope.amplitude) {
            mod += envelopeValueAtTime(instrument.ampEnvelope, time, gateLength)
        }
        if (instrument.ampLFO?.amplitude) {
            mod += lfoValueAtTime(instrument.ampLFO, time)
        }
        return ((Math.max(Math.min(mod, instrument.ampEnvelope.amplitude), 0) / 1024) * maxVolume) | 0;
    }

    function envelopeValueAtTime(envelope: Envelope, time: number, gateLength: number) {
        const adjustedSustain = (envelope.sustain / 1024) * envelope.amplitude;

        if (time > gateLength) {
            if (time - gateLength > envelope.release) return 0;

            else if (time < envelope.attack) {
                const height = (envelope.amplitude / envelope.attack) * gateLength;
                return height - ((height / envelope.release) * (time - gateLength))
            }
            else if (time < envelope.attack + envelope.decay) {
                const height2 = envelope.amplitude - ((envelope.amplitude - adjustedSustain) / envelope.decay) * (gateLength - envelope.attack);
                return height2 - ((height2 / envelope.release) * (time - gateLength))
            }
            else {
                return adjustedSustain - (adjustedSustain / envelope.release) * (time - gateLength)
            }
        }
        else if (time < envelope.attack) {
            return (envelope.amplitude / envelope.attack) * time
        }
        else if (time < envelope.attack + envelope.decay) {
            return envelope.amplitude - ((envelope.amplitude - adjustedSustain) / envelope.decay) * (time - envelope.attack)
        }
        else {
            return adjustedSustain;
        }
    }

    function lfoValueAtTime(lfo: LFO, time: number) {
        return Math.cos(((time / 1000) * lfo.frequency) * 2 * Math.PI) * lfo.amplitude
    }

    function set16BitNumber(buf: Uint8Array, offset: number, value: number) {
        const temp = new Uint8Array(2);
        new Uint16Array(temp.buffer)[0] = value | 0;
        buf[offset] = temp[0];
        buf[offset + 1] = temp[1];
    }

    function addNote(sndInstr: Uint8Array, sndInstrPtr: number, ms: number, beg: number, end: number, soundWave: number, hz: number, endHz: number) {
        if (ms > 0) {
            sndInstr[sndInstrPtr] = soundWave;
            sndInstr[sndInstrPtr + 1] = 0;
            set16BitNumber(sndInstr, sndInstrPtr + 2, hz)
            set16BitNumber(sndInstr, sndInstrPtr + 4, ms)
            set16BitNumber(sndInstr, sndInstrPtr + 6, (beg * 255) >> 6)
            set16BitNumber(sndInstr, sndInstrPtr + 8, (end * 255) >> 6)
            set16BitNumber(sndInstr, sndInstrPtr + 10, endHz);
            sndInstrPtr += BUFFER_SIZE;
        }
        sndInstr[sndInstrPtr] = 0;
        return sndInstrPtr
    }

    export function encodeSongToHex(song: Song) {
        const encoded = encodeSong(song);
        return `hex\`${U.toHex(encoded)}\``
    }

    /**
     * Byte encoding format for songs
     * FIXME: should this all be word aligned?
     *
     * song(7 + length of all tracks bytes)
     *     0 version
     *     1 beats per minute
     *     3 beats per measure
     *     4 ticks per beat
     *     5 measures
     *     6 number of tracks
     *     ...tracks
     *
     * track(6 + instrument length + note length bytes)
     *     0 id
     *     1 flags
     *     2 instruments byte length
     *     4...instrument
     *     notes byte length
     *     ...note events
     *
     * instrument(27 bytes)
     *     0 waveform
     *     1 amp attack
     *     3 amp decay
     *     5 amp sustain
     *     7 amp release
     *     9 amp amp
     *     11 pitch attack
     *     13 pitch decay
     *     15 pitch sustain
     *     17 pitch release
     *     19 pitch amp
     *     21 amp lfo freq
     *     22 amp lfo amp
     *     24 pitch lfo freq
     *     25 pitch lfo amp
     *
     * drum(5 + 7 * steps bytes)
     *     0 steps
     *     1 start freq
     *     3 start amp
     *     5...steps
     *
     * drum step(7 bytes)
     *     0 waveform
     *     1 freq
     *     3 volume
     *     5 duration
     *
     * note event(5 + 1 * polyphony bytes)
     *     0 start tick
     *     2 end tick
     *     4 polyphony
     *     5...notes(1 byte each)
     *
     */

    function encodeSong(song: Song) {
        const encodedTracks = song.tracks
            .map((track, index) => [track, index] as [Track, number])
            .filter(([track, index]) => track.notes.length > 0)
            .map(([track, index]) => encodeTrack(track, index));
        const trackLength = encodedTracks.reduce((d, c) => c.length + d, 0);

        const out = new Uint8Array(7 + trackLength);
        out[0] = 0; // encoding version
        set16BitNumber(out, 1, song.beatsPerMinute);
        out[3] = song.beatsPerMeasure;
        out[4] = song.ticksPerBeat;
        out[5] = song.measures;
        out[6] = encodedTracks.length;

        let current = 7;
        for (const track of encodedTracks) {
            out.set(track, current);
            current += track.length;
        }

        return out;
    }

    function encodeInstrument(instrument: Instrument) {
        const out = new Uint8Array(28);
        out[0] = instrument.waveform;
        set16BitNumber(out, 1, instrument.ampEnvelope.attack)
        set16BitNumber(out, 3, instrument.ampEnvelope.decay)
        set16BitNumber(out, 5, instrument.ampEnvelope.sustain)
        set16BitNumber(out, 7, instrument.ampEnvelope.release)
        set16BitNumber(out, 9, instrument.ampEnvelope.amplitude)
        set16BitNumber(out, 11, instrument.pitchEnvelope?.attack || 0)
        set16BitNumber(out, 13, instrument.pitchEnvelope?.decay || 0)
        set16BitNumber(out, 15, instrument.pitchEnvelope?.sustain || 0)
        set16BitNumber(out, 17, instrument.pitchEnvelope?.release || 0)
        set16BitNumber(out, 19, instrument.pitchEnvelope?.amplitude || 0)
        out[21] = instrument.ampLFO?.frequency || 0
        set16BitNumber(out, 22, instrument.ampLFO?.amplitude || 0)
        out[24] = instrument.pitchLFO?.frequency || 0
        set16BitNumber(out, 25, instrument.pitchLFO?.amplitude || 0);

        return out;
    }

    function encodeDrumInstrument(drum: DrumInstrument) {
        const out = new Uint8Array(5 + 7 * drum.steps.length);
        out[0] = drum.steps.length;
        set16BitNumber(out, 1, drum.startFrequency);
        set16BitNumber(out, 3, drum.startVolume);

        for (let i = 0; i < drum.steps.length; i++) {
            const start = 5 + i * 7;
            out[start] = drum.steps[i].waveform;
            set16BitNumber(out, start + 1, drum.steps[i].frequency);
            set16BitNumber(out, start + 3, drum.steps[i].volume);
            set16BitNumber(out, start + 5, drum.steps[i].duration);
        }

        return out;
    }

    function encodeNoteEvent(event: NoteEvent) {
        const out = new Uint8Array(5 + event.notes.length);
        set16BitNumber(out, 0, event.startTick);
        set16BitNumber(out, 2, event.endTick);
        out[4] = event.notes.length;

        for (let i = 0; i < event.notes.length; i++) {
            out[5 + i] = event.notes[i];
        }

        return out;
    }

    function encodeTrack(track: Track, index: number) {
        if (track.drums) return encodeDrumTrack(track, index);
        return encodeMelodicTrack(track, index);
    }

    function encodeMelodicTrack(track: Track, id: number) {
        const encodedInstrument = encodeInstrument(track.instrument);
        const encodedNotes = track.notes.map(encodeNoteEvent);
        const noteLength = encodedNotes.reduce((d, c) => c.length + d, 0);

        const out = new Uint8Array(6 + encodedInstrument.length + noteLength);
        out[0] = id;
        out[1] = 0;

        set16BitNumber(out, 2, encodedInstrument.length);
        let current = 4;
        out.set(encodedInstrument, current);
        current += encodedInstrument.length;

        set16BitNumber(out, current, noteLength);
        current += 2;
        for (const note of encodedNotes) {
            out.set(note, current);
            current += note.length
        }

        return out;
    }

    function encodeDrumTrack(track: Track, id: number) {
        const encodedDrums = track.drums.map(encodeDrumInstrument);
        const drumLength = encodedDrums.reduce((d, c) => c.length + d, 0);

        const encodedNotes = track.notes.map(encodeNoteEvent);
        const noteLength = encodedNotes.reduce((d, c) => c.length + d, 0);

        const out = new Uint8Array(6 + drumLength + noteLength);
        out[0] = id;
        out[1] = 1;
        set16BitNumber(out, 2, drumLength);
        let current = 4;

        for (const drum of encodedDrums) {
            out.set(drum, current);
            current += drum.length
        }

        set16BitNumber(out, current, noteLength);
        current += 2;
        for (const note of encodedNotes) {
            out.set(note, current);
            current += note.length
        }

        return out;
    }
}