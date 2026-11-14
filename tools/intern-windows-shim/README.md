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

Checked on Windows 10 with the shim: `intern --help`, and a headless task (`intern -p`) that read a JSON file and wrote a Markdown file, with Drex as System 1 and `Qwen/Qwen3.8-27B` on DeepInfra as System 2.
Tools that manage process groups may still misbehave; file reads and writes do not use them.

Also run it with `PYTHONUTF8=1` in the environment: Intern prints characters such as ✗ and → that the default Windows console code page cannot encode, and that stops the run. Clio's report writer sets it.
