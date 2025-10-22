#!/bin/bash

echo "WARNING: This will permanently delete all Free Sleep data located at /persistent/free-sleep-data/"
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deleting Free Sleep data..."
    rm -rf /persistent/free-sleep-data/
    echo "Data deleted."
else
    echo "Operation cancelled."
fi
