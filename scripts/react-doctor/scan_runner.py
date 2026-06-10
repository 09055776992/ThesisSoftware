"""
Scan runner module for React Doctor.

This module provides the ReactDoctorScan class that executes React Doctor
scans and parses the output. It supports both JSON and text output modes,
and can filter results to only include specific files.

Requirements: 2.1, 2.4
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class ReactDoctorScanError(Exception):
    """Exception raised when React Doctor scan fails."""
    pass


class ReactDoctorScan:
    """
    Executes React Doctor scans and parses the output.
    
    This class handles:
    - Executing the React Doctor CLI command
    - Parsing the JSON output
    - Extracting relevant diagnostic information
    """
    
    def __init__(self, project_dir: str = "FrontEnd", output_mode: str = "json"):
        """
        Initialize the scan runner.
        
        Args:
            project_dir: Path to the project directory to scan
            output_mode: Output format mode - 'json' or 'text'
        """
        self.project_dir = Path(project_dir).resolve()
        self.output_mode = output_mode
        self.cwd = str(self.project_dir)
    
    def execute_scan(self, files: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute React Doctor scan on the project directory or specific files.
        
        Args:
            files: Optional list of specific files to scan (currently not supported by CLI)
            
        Returns:
            Parsed JSON output from React Doctor
            
        Raises:
            ReactDoctorScanError: If the scan fails
        """
        try:
            command = ["npx", "react-doctor", "."]
            
            if self.output_mode == "json":
                command.append("--json")
            
            # Run the command and capture output
            # Use shell=True on Windows to find npx in PATH
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=self.cwd,
                shell=sys.platform == "win32"
            )
            
            # Check if command succeeded
            if result.returncode != 0 and not result.stdout.strip():
                error_message = result.stderr.strip() if result.stderr else "Unknown error"
                raise ReactDoctorScanError(
                    f"React Doctor scan failed: {error_message}"
                )
            
            # Parse the JSON output (React Doctor always outputs JSON with --json flag)
            if self.output_mode == "json":
                try:
                    scan_data = json.loads(result.stdout)
                except json.JSONDecodeError as e:
                    raise ReactDoctorScanError(
                        f"Failed to parse React Doctor output as JSON: {e}"
                    )
            else:
                # For text mode, return a structured dict with raw text
                scan_data = {
                    "ok": result.returncode == 0,
                    "raw_output": result.stdout,
                    "error_output": result.stderr
                }
            
            return scan_data
            
        except subprocess.TimeoutExpired:
            raise ReactDoctorScanError(
                "React Doctor scan timed out after 5 minutes"
            )
        except FileNotFoundError:
            raise ReactDoctorScanError(
                "Could not find npx or react-doctor. Ensure Node.js is installed."
            )
    
    def extract_diagnostics(self, scan_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract diagnostics from scan result.
        
        Args:
            scan_data: Raw scan data from React Doctor
            
        Returns:
            List of diagnostic issues
        """
        diagnostics = []
        
        # Handle error case
        if not scan_data.get("ok", False):
            error = scan_data.get("error", {})
            if error:
                raise ReactDoctorScanError(
                    f"Scan error: {error.get('message', 'Unknown error')}"
                )
            return diagnostics
        
        # Extract diagnostics from all projects
        for project in scan_data.get("projects", []):
            for diagnostic in project.get("diagnostics", []):
                diagnostics.append(diagnostic)
        
        return diagnostics
    
    def get_summary(self, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get summary statistics from scan result.
        
        Args:
            scan_data: Raw scan data from React Doctor
            
        Returns:
            Dictionary with summary statistics
        """
        summary = scan_data.get("summary", {})
        
        return {
            "total_issues": summary.get("totalDiagnosticCount", 0),
            "error_count": summary.get("errorCount", 0),
            "warning_count": summary.get("warningCount", 0),
            "affected_file_count": summary.get("affectedFileCount", 0),
            "score": summary.get("score"),
            "score_label": summary.get("scoreLabel"),
        }


def run_scan(
    project_dir: str = "FrontEnd",
    files: Optional[List[str]] = None,
    output_mode: str = "json",
    output_file: Optional[str] = None
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Run a React Doctor scan and return structured data.
    
    Args:
        project_dir: Path to the project directory
        files: Optional list of specific files to filter results (scan runs on entire project)
        output_mode: Output format - 'json' or 'text'
        output_file: Optional file path to save raw output
        
    Returns:
        Tuple of (summary, diagnostics_list)
    """
    scanner = ReactDoctorScan(project_dir, output_mode)
    
    # Execute the scan (React Doctor scans entire project directory)
    scan_data = scanner.execute_scan()
    
    # Optionally save raw output
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            if output_mode == "json":
                json.dump(scan_data, f, indent=2)
            else:
                f.write(scan_data.get("raw_output", ""))
    
    # Extract summary and diagnostics
    summary = scanner.get_summary(scan_data)
    diagnostics = scanner.extract_diagnostics(scan_data)
    
    # Filter diagnostics to only include specified files if provided
    if files:
        # Normalize file paths for comparison
        # Files from scanner are like: app/App.tsx
        # Files in scan output are like: src/app/App.tsx
        normalized_files = []
        for f in files:
            normalized = f.replace('\\', '/')
            # Prepend 'src/' if not already present
            if not normalized.startswith('src/'):
                normalized = 'src/' + normalized
            normalized_files.append(normalized)
        
        diagnostics = [
            diag for diag in diagnostics
            if diag.get("filePath", "").replace('\\', '/') in normalized_files
        ]
        
        # Update summary to reflect filtered results
        affected_files = set(diag.get("filePath", "") for diag in diagnostics)
        summary["total_issues"] = len(diagnostics)
        summary["affected_file_count"] = len(affected_files)
    
    return summary, diagnostics


def main():
    """Main entry point for the scan runner."""
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
        "--files",
        nargs="+",
        help="Specific files to filter results (default: all files)"
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
    
    args = parser.parse_args()
    
    if not args.quiet:
        print(f"Running React Doctor scan on {args.project_dir}...")
        if args.files:
            print(f"Filtering to {len(args.files)} file(s)...")
        print()
    
    try:
        summary, diagnostics = run_scan(
            project_dir=args.project_dir,
            files=args.files,
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
                
    except ReactDoctorScanError as e:
        print(f"Scan error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
