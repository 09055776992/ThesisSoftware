"""
File scanner script for React Doctor.

This script scans the FrontEnd/src directory for React files (.tsx, .jsx, .ts, .js)
and returns a list of file paths with proper path normalization.
"""

import os
import re
from pathlib import Path
from typing import List, Optional


def normalize_path(path: str) -> str:
    """
    Normalize a file path for consistent representation.
    
    Args:
        path: Raw file path
        
    Returns:
        Normalized path with forward slashes and relative to project root
    """
    # Convert backslashes to forward slashes for consistency
    normalized = path.replace(os.sep, '/')
    
    # Remove leading ./
    if normalized.startswith('./'):
        normalized = normalized[2:]
    
    return normalized


def should_exclude(path: str, exclude_patterns: Optional[List[str]] = None) -> bool:
    """
    Check if a file path should be excluded from scanning.
    
    Args:
        path: File path to check
        exclude_patterns: List of regex patterns for exclusion
        
    Returns:
        True if the path should be excluded, False otherwise
    """
    default_patterns = [
        r'node_modules',
        r'\.git',
        r'dist',
        r'build',
        r'\.cache',
        r'coverage',
        r'public',
        r'__pycache__',
        r'\.env',
    ]
    
    patterns = exclude_patterns if exclude_patterns else default_patterns
    
    for pattern in patterns:
        if re.search(pattern, path, re.IGNORECASE):
            return True
    
    return False


def is_react_file(filename: str) -> bool:
    """
    Check if a file is a React file based on its extension.
    
    Args:
        filename: Name of the file to check
        
    Returns:
        True if the file is a React file (.tsx, .jsx, .ts, .js), False otherwise
    """
    react_extensions = {'.tsx', '.jsx', '.ts', '.js'}
    _, ext = os.path.splitext(filename)
    return ext.lower() in react_extensions


def scan_directory(
    base_dir: str,
    include_patterns: Optional[List[str]] = None,
    exclude_patterns: Optional[List[str]] = None
) -> List[str]:
    """
    Scan a directory for React files.
    
    Args:
        base_dir: Base directory to scan
        include_patterns: Optional regex patterns for including specific files
        exclude_patterns: Optional regex patterns for excluding files
        
    Returns:
        List of normalized paths to React files
    """
    base_path = Path(base_dir)
    
    if not base_path.exists():
        raise ValueError(f"Directory does not exist: {base_dir}")
    
    if not base_path.is_dir():
        raise ValueError(f"Path is not a directory: {base_dir}")
    
    react_files = []
    
    for root, dirs, files in os.walk(base_dir):
        # Normalize the root path
        relative_root = os.path.relpath(root, base_dir)
        normalized_root = normalize_path(relative_root) if relative_root != '.' else '.'
        
        # Filter out excluded directories
        dirs_to_remove = []
        for dir_name in dirs:
            dir_path = os.path.join(normalized_root, dir_name) if normalized_root != '.' else dir_name
            if should_exclude(dir_path, exclude_patterns):
                dirs_to_remove.append(dir_name)
        
        for dir_name in dirs_to_remove:
            dirs.remove(dir_name)
        
        # Process files in current directory
        for filename in files:
            if not is_react_file(filename):
                continue
            
            file_path = os.path.join(normalized_root, filename) if normalized_root != '.' else filename
            
            # Apply include patterns if specified
            if include_patterns:
                if not any(re.search(pattern, file_path) for pattern in include_patterns):
                    continue
            
            # Apply exclude patterns
            if should_exclude(file_path, exclude_patterns):
                continue
            
            normalized_path = normalize_path(file_path)
            react_files.append(normalized_path)
    
    return sorted(react_files)


def get_react_files(
    src_dir: str = 'FrontEnd/src',
    exclude_patterns: Optional[List[str]] = None
) -> List[str]:
    """
    Get all React files from the src directory.
    
    Args:
        src_dir: Path to the src directory
        exclude_patterns: Optional list of regex patterns for exclusion
        
    Returns:
        List of normalized paths to React files
    """
    return scan_directory(src_dir, exclude_patterns=exclude_patterns)


if __name__ == '__main__':
    # Default configuration
    src_directory = 'FrontEnd/src'
    exclude_dirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'coverage']
    
    print(f"Scanning for React files in {src_directory}...")
    print(f"Excluding directories: {', '.join(exclude_dirs)}")
    print()
    
    try:
        files = get_react_files(src_directory, exclude_dirs)
        
        if files:
            print(f"Found {len(files)} React file(s):\n")
            for file in files:
                print(f"  - {file}")
        else:
            print("No React files found.")
            
    except ValueError as e:
        print(f"Error: {e}")
        exit(1)
