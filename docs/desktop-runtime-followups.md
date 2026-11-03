# Desktop App Runtime Follow-ups

This file parks startup and real-device investigations until the UI work is complete.
It is intentionally separate from the NAM interface redesign.

## Current Status

- No runtime startup failure has been reproduced in this UI-only pass.
- The native app has not been launched or tested with a physical audio interface here.
- Keep this list for a later, separate debugging task.

## Deferred Checks

- Launch the packaged app and capture any startup error or permission prompt.
- Confirm input/output device enumeration, input channel selection, and negotiated sample rate/buffer size.
- Start and stop monitoring; check that input level responds and audio reaches the selected output.
- Load a local NAM model and WAV IR, then save and restore a preset.
- Check device disconnect/reconnect and sleep/wake recovery; record audible dropouts and underrun counts.

## Details to Record If a Problem Appears

- macOS version and Mac architecture.
- Audio interface model and how it is connected.
- The exact action that fails and the visible error/status text.
- Terminal or Console output around the failure, plus the selected device, sample rate, and buffer size.

Do not attach model or IR files to a report; local filenames and paths can be anonymized.
