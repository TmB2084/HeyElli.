"""Extract an authenticated backup into an empty private directory; no links or overwrites."""
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile

archive, destination = sys.argv[1:]
target = Path(destination)
target.mkdir(mode=0o700)
with tarfile.open(archive, "r:gz") as source:
    entries = []
    total = 0
    for member in source:
        entries.append(member)
        total += member.size
        if len(entries) > 100000 or total > 40 * 1024**3:
            raise ValueError("Archive limits exceeded")
    for member in entries:
        name = member.name
        if name in (".", "./"):
            continue
        while name.startswith("./"):
            name = name[2:]
        path = PurePosixPath(name)
        if not name or path.is_absolute() or ".." in path.parts or "\\" in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
            raise ValueError("Unsafe archive path")
        if not (member.isfile() or member.isdir()):
            raise ValueError("Links and special files are not supported")
    for member in entries:
        if member.name in (".", "./"):
            continue
        name = member.name
        while name.startswith("./"):
            name = name[2:]
        path = target / name
        if member.isdir():
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
        else:
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with path.open("xb") as output, source.extractfile(member) as stream:
                os.chmod(path, 0o600)
                shutil.copyfileobj(stream, output)
