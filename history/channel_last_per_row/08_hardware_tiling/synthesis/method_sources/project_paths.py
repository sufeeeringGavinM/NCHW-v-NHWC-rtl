"""Resolve projects in staging or in the deployed sibling layout."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def project_path(name):
    local = ROOT / name
    return local if local.is_dir() else ROOT.parent / name
