# Architecture

## Why it exists

The loop writes an outcome line for every run -- what it did, to what, and why -- and that
line is the only place its behaviour is visible without reading logs. loopscope reads them
back and shows the answer to the two questions a person actually has: *is anything waiting
for me*, and *what has it been doing*.

## Data flow

    forge (Actions runs, outcome lines)
      -> server: poll, parse, diff
      -> WebSocket: snapshot on connect, one message per change
      -> web: attention first, then running, then history

Polling is the first version. A webhook is the second, and the socket already carries "here
is a run" rather than "here is everything again", so the change is in one file.

## What it deliberately does not hold

No database, no accounts, no write path to the forge. If it is switched off for a day it
loses nothing, and it can never be the reason a change did or did not merge.
