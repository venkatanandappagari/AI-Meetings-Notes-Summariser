#!/usr/bin/env python3
"""
Simple runner script for the AI Meeting Notes Summarizer.
This script can be used as an alternative to running main.py directly.
"""

if __name__ == '__main__':
    from main import app
    print("Starting AI Meeting Notes Summarizer...")
    print("Access the application at: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)