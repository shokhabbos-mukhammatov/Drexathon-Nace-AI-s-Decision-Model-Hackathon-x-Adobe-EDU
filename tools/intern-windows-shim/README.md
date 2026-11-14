# Intern on Windows

Intern (github.com/nace-ai/intern) imports the Unix-only `fcntl` module and refers to
`signal.SIGHUP`, `signal.SIGKILL` and `os.killpg`, so it does not start on Windows. These two
files let it start:

- `fcntl.py`: a stand-in that implements `flock()` with `msvcrt` byte-range locks.
- `_intern_windows_shim.pth`: defines the missing signal names and `os.killpg` at interpreter start.

Copy both into the tool's site-packages, for a `uv tool install`:

```
%APPDATA%\uv\tools\intern-agent\Lib\site-packages\
```

Checked: `intern --help` runs on Windows 10 with the shim. Not checked: a full headless task.
Tools that manage process groups may still misbehave; file reads and writes do not use them.
