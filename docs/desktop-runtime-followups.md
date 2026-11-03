# Desktop App Runtime Follow-ups

This file parks startup and real-device investigations until the UI work is complete.
It is intentionally separate from the NAM interface redesign.

## Current Status

- `go build ./...` passes for `desktop/`.
- On 2026-11-03, `go run .` from `desktop/` stayed active but emitted JUCE assertions during startup: `juce_CoreMidi_mac.mm:529`, `juce_CoreMidi_mac.mm:1087`, `juce_MidiDeviceListConnectionBroadcaster.cpp:221`, and repeated `juce_AsyncUpdater.cpp:78`. Stopping the process emitted `juce_MidiDeviceListConnectionBroadcaster.cpp:255`.
- Monitoring was not started, and no physical audio interface was used. The MyGo window was not available in the desktop app inventory, so native-window visual inspection remains open.
- Keep this list for a later, separate debugging task.

## Deferred Checks

- Launch the packaged app and capture any startup error or permission prompt.
- Confirm input/output device enumeration, input channel selection, and negotiated sample rate/buffer size.
- Start and stop monitoring; check that input level responds and audio reaches the selected output.
- Load a local NAM model and WAV IR, then save and restore a preset.
- Check device disconnect/reconnect and sleep/wake recovery; record audible dropouts and underrun counts.

## Known Follow-ups

- The device list is refreshed at startup only. A device connected afterward is not selectable until the app is restarted.
- Chain edits clone loaded NAM and IR modules from their source paths. If a source file is moved or deleted after loading, reorder or removal may fail while cloning the chain.

## Details to Record If a Problem Appears

- macOS version and Mac architecture.
- Audio interface model and how it is connected.
- The exact action that fails and the visible error/status text.
- Terminal or Console output around the failure, plus the selected device, sample rate, and buffer size.

Do not attach model or IR files to a report; local filenames and paths can be anonymized.
