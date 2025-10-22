#!/usr/bin/env python3
"""Script to replace all references of 'zeus' with 'zeus' throughout the codebase.

This script handles:
- Case-preserving replacements (Zeus -> Zeus, zeus -> zeus, ZEUS -> ZEUS)
- Package names (zeus-ai -> zeus-ai, @zeus-ai -> @zeus-ai)
- URLs and paths (.zeus -> .zeus, /zeus -> /zeus)
- Environment variables (ZEUS_ -> ZEUS_)
- Dry-run mode to preview changes before applying
"""

import re
from pathlib import Path
from typing import Dict, List, Pattern, Tuple


# Directories to exclude from search
EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    ".turbo",
    ".next",
    ".cache",
}

# File extensions to process
INCLUDE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".toml",
    ".go",
    ".py",
    ".sh",
    ".bash",
    ".env",
    ".gitignore",
    ".html",
    ".css",
    ".scss",
    ".svg",
}

# Files to always process (even without extension)
ALWAYS_PROCESS = {
    "Dockerfile",
    "Makefile",
    "README",
    "LICENSE",
    "CONTRIBUTING",
    "CHANGELOG",
}


def get_replacement_patterns() -> List[Tuple[Pattern[str], str]]:
    """Get list of (pattern, replacement) tuples for different cases."""
    return [
        # Exact case matches
        (re.compile(r"\bOpenCode\b"), r"Zeus"),
        (re.compile(r"\bopencode\b"), r"zeus"),
        (re.compile(r"\bOPENCODE\b"), r"ZEUS"),
        # Package names
        (re.compile(r"\bopencode-ai\b"), r"zeus-ai"),
        (re.compile(r"\bOpenCode-AI\b"), r"Zeus-AI"),
        (re.compile(r"@zeus-ai\b"), r"@zeus-ai"),
        # URLs and domains
        (re.compile(r"zeus\.ai"), r"zeus.ai"),
        # Paths and directories
        (re.compile(r"\.zeus\b"), r".zeus"),
        (re.compile(r"/zeus\b"), r"/zeus"),
        (re.compile(r"\\zeus\b"), r"\\zeus"),
        # Environment variables
        (re.compile(r"\bOPENCODE_"), r"ZEUS_"),
        # Package/module references
        (re.compile(r"packages/zeus\b"), r"packages/zeus"),
        (re.compile(r"@zeus\b"), r"@zeus"),
    ]


def should_process_file(file_path: Path) -> bool:
    """Determine if a file should be processed."""
    # Check if in excluded directory
    for part in file_path.parts:
        if part in EXCLUDE_DIRS:
            return False

    # Check if it's a file we always process
    if file_path.name in ALWAYS_PROCESS:
        return True

    # Check extension
    return file_path.suffix in INCLUDE_EXTENSIONS


def replace_in_file(
    file_path: Path, patterns: List[Tuple[Pattern[str], str]], dry_run: bool = True
) -> Tuple[bool, int]:
    """Replace patterns in a single file.

    Returns:
        (changed, num_replacements) tuple
    """
    try:
        # Read file content
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        original_content = content
        total_replacements = 0

        # Apply all patterns
        for pattern, replacement in patterns:
            content, n = pattern.subn(replacement, content)
            total_replacements += n

        # Check if content changed
        if content != original_content:
            if not dry_run:
                # Write back if not dry run
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
            return True, total_replacements

        return False, 0

    except Exception as e:
        print(f"  ⚠️  Error processing {file_path}: {e}")
        return False, 0


def find_and_replace(root_dir: Path, dry_run: bool = True) -> Dict[str, int]:
    """Find and replace zeus -> zeus in all relevant files.

    Returns:
        Dictionary with statistics
    """
    patterns = get_replacement_patterns()
    stats = {
        "files_scanned": 0,
        "files_changed": 0,
        "total_replacements": 0,
    }

    changed_files = []

    print(f"\n{'=' * 60}")
    print("⚡ Zeus Renaming Script")
    print(f"{'=' * 60}")
    print(
        f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE (files will be modified)'}"
    )
    print(f"Root: {root_dir}")
    print(f"\n{'=' * 60}\n")

    # Walk through directory tree
    for file_path in root_dir.rglob("*"):
        if file_path.is_file() and should_process_file(file_path):
            stats["files_scanned"] += 1

            changed, num_replacements = replace_in_file(file_path, patterns, dry_run)

            if changed:
                stats["files_changed"] += 1
                stats["total_replacements"] += num_replacements
                relative_path = file_path.relative_to(root_dir)
                changed_files.append((relative_path, num_replacements))
                print(f"  ✓ {relative_path} ({num_replacements} replacements)")

    # Print summary
    print(f"\n{'=' * 60}")
    print("Summary:")
    print(f"{'=' * 60}")
    print(f"Files scanned: {stats['files_scanned']}")
    print(f"Files changed: {stats['files_changed']}")
    print(f"Total replacements: {stats['total_replacements']}")

    if dry_run and stats["files_changed"] > 0:
        print("\n⚠️  This was a DRY RUN. No files were modified.")
        print("Run with --apply to make actual changes.")
    elif not dry_run and stats["files_changed"] > 0:
        print("\n✅ Changes applied successfully!")

    print(f"{'=' * 60}\n")

    return stats


def main() -> int:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Replace all references of zeus with zeus in the codebase"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Apply changes (default is dry-run)"
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Root directory to process (default: current directory)",
    )

    args = parser.parse_args()

    # Run the replacement
    stats = find_and_replace(root_dir=args.root, dry_run=not args.apply)

    return 0 if stats["files_changed"] >= 0 else 1


if __name__ == "__main__":
    exit(main())
