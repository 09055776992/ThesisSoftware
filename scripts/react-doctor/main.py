"""
Main scan script for React Doctor.

This script orchestrates the React Doctor scanning process by:
1. Using the file scanner to find React files
2. Running React Doctor on the project directory
3. Filtering results to only include scanned files
4. Providing output summary

Requirements: 2.2, 3.1
"""

import sys
from pathlib import Path

# Add the script directory to path for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from scan_files import get_react_files
from scan_runner import run_scan, ReactDoctorScanError


def main():
    """Main entry point for the scan orchestration."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Run React Doctor scan on project files"
    )
    parser.add_argument(
        "project_dir",
        nargs="?",
        default="FrontEnd",
        help="Path to the project directory (default: FrontEnd)"
    )
    parser.add_argument(
        "--src-dir",
        default="FrontEnd/src",
        help="Path to the src directory to scan (default: FrontEnd/src)"
    )
    parser.add_argument(
        "--mode",
        choices=["json", "text"],
        default="json",
        help="Output mode (default: json)"
    )
    parser.add_argument(
        "--output-file",
        help="File to save raw output"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress output"
    )
    parser.add_argument(
        "--exclude",
        nargs="+",
        default=None,
        help="Additional patterns to exclude when scanning"
    )
    
    args = parser.parse_args()
    
    # Scan for files
    if not args.quiet:
        print(f"Scanning for React files in {args.src_dir}...")
    
    try:
        files = get_react_files(args.src_dir, exclude_patterns=args.exclude)
        
        if not files:
            print("No React files found.")
            return 0
        
        if not args.quiet:
            print(f"Found {len(files)} React file(s).\n")
        
        # Run the scan
        if not args.quiet:
            print(f"Running React Doctor scan on {args.project_dir}...")
            print()
        
        summary, diagnostics = run_scan(
            project_dir=args.project_dir,
            files=files,
            output_mode=args.mode,
            output_file=args.output_file
        )
        
        # Print summary if not quiet
        if not args.quiet:
            print(f"Scan completed successfully!")
            print(f"  Total issues: {summary['total_issues']}")
            print(f"  Errors: {summary['error_count']}")
            print(f"  Warnings: {summary['warning_count']}")
            print(f"  Affected files: {summary['affected_file_count']}")
            print()
            
            # Print diagnostics
            if diagnostics:
                print("Diagnostics found:")
                for i, diag in enumerate(diagnostics[:10], 1):  # Show first 10
                    severity = diag.get("severity", "unknown").upper()
                    file_path = diag.get("filePath", "unknown")
                    rule = diag.get("rule", "unknown")
                    message = diag.get("message", "")
                    
                    # Truncate long messages
                    if len(message) > 80:
                        message = message[:77] + "..."
                    
                    print(f"  {i}. [{severity}] {file_path} - {rule}: {message}")
                
                if len(diagnostics) > 10:
                    print(f"  ... and {len(diagnostics) - 10} more")
            else:
                print("No diagnostics found!")
        
        return 0
        
    except ReactDoctorScanError as e:
        print(f"Scan error: {e}")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
