"""Minimal Windows stand-in for the Unix fcntl module, added so Intern can start on Windows.
Only flock() is provided, implemented with msvcrt byte-range locks."""
import msvcrt, os
LOCK_SH, LOCK_EX, LOCK_NB, LOCK_UN = 1, 2, 4, 8

def flock(fd, operation):
    if hasattr(fd, "fileno"):
        fd = fd.fileno()
    try:
        pos = os.lseek(fd, 0, os.SEEK_CUR)
        os.lseek(fd, 0, os.SEEK_SET)
        if operation & LOCK_UN:
            try:
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
        else:
            msvcrt.locking(fd, msvcrt.LK_NBLCK if operation & LOCK_NB else msvcrt.LK_LOCK, 1)
        os.lseek(fd, pos, os.SEEK_SET)
    except OSError:
        if operation & LOCK_NB:
            raise
