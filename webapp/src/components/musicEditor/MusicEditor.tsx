import * as React from "react";
import { EditControls } from "./EditControls";
import { isPlaying, playNoteAsync, tickToMs, updatePlaybackSongAsync } from "./playback";
import { PlaybackControls } from "./PlaybackControls";
import { ScrollableWorkspace } from "./ScrollableWorkspace";
import { GridResolution, TrackSelector } from "./TrackSelector";
import { addNoteToTrack, editNoteEventLength, findClosestPreviousNote, removeNoteFromTrack, rowToNote } from "./utils";

export interface MusicEditorProps {
    song: pxt.assets.music.Song;

}

export const MusicEditor = (props: MusicEditorProps) => {
    const { song } = props;
    const [selectedTrack, setSelectedTrack] = React.useState(0);
    const [gridResolution, setGridResolution] = React.useState<GridResolution>("1/8");
    const [currentSong, setCurrentSong] = React.useState(song);
    const editSong = React.useRef<pxt.assets.music.Song>()

    const gridTicks = gridResolutionToTicks(gridResolution, currentSong.ticksPerBeat);

    const updateSong = (newSong: pxt.assets.music.Song) => {
        if (isPlaying()) {
            updatePlaybackSongAsync(newSong);
        }
        setCurrentSong(newSong);
    }

    const onRowClick = (row: number, startTick: number) => {
        const instrument = currentSong.tracks[selectedTrack].instrument
        const note = rowToNote(instrument.octave, row);


        const existingEvent = findClosestPreviousNote(currentSong, selectedTrack, startTick);

        if (existingEvent?.startTick === startTick && existingEvent.notes.indexOf(note) !== -1) {
            updateSong(removeNoteFromTrack(currentSong, selectedTrack, note, startTick));
        }
        else {
            updateSong(addNoteToTrack(currentSong, selectedTrack, note, startTick, startTick + gridTicks))
            playNoteAsync(note, instrument, tickToMs(currentSong, gridTicks))
        }
    }

    const onNoteDragStart = () => {
        editSong.current = currentSong;
    }

    const onNoteDragEnd = () => {
        editSong.current = undefined;
    }

    const onNoteDrag = (start: WorkspaceCoordinate, end: WorkspaceCoordinate) => {
        const event = findClosestPreviousNote(editSong.current, selectedTrack, start.tick);

        if (!event || end.tick < event.startTick + 1) return;

        updateSong(editNoteEventLength(editSong.current, selectedTrack, event.startTick, end.tick));
    }

    return <div>
        <TrackSelector
            song={currentSong}
            selected={selectedTrack}
            onTrackSelected={setSelectedTrack}
            selectedResolution={gridResolution}
            onResolutionSelected={setGridResolution} />
        <ScrollableWorkspace
            song={currentSong}
            selectedTrack={selectedTrack}
            onWorkspaceClick={onRowClick}
            onWorkspaceDragStart={onNoteDragStart}
            onWorkspaceDragEnd={onNoteDragEnd}
            onWorkspaceDrag={onNoteDrag}
            gridTicks={gridTicks} />
        <PlaybackControls song={currentSong} />
        <EditControls />
    </div>
}

function gridResolutionToTicks(resolution: GridResolution, ticksPerBeat: number) {
    switch (resolution) {
        case "1/4": return ticksPerBeat;
        case "1/8": return ticksPerBeat / 2;
        case "1/16": return ticksPerBeat / 4;
        case "1/32": return ticksPerBeat / 8;
    }
}