from pathlib import Path

ROOT_MARKER = ".permit-helper-root"


class RootNotFound(Exception):
    pass


def get_repo_root_path() -> Path:
    """Walk up from this file until a directory containing the root marker is found."""
    here = Path(__file__).resolve()
    for directory in here.parents:
        if (directory / ROOT_MARKER).is_file():
            return directory
    raise RootNotFound(f"No {ROOT_MARKER} found above {here}")
