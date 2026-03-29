#!/bin/bash
# Resets all local Runthroo user data for a clean first-run experience.
# This deletes the database, captures, thumbnails, and the initialization flag.

APP_SUPPORT="$HOME/Library/Application Support/Runthroo"

echo "Cleaning Runthroo local data at: $APP_SUPPORT"

rm -f "$APP_SUPPORT/demoforge.db" "$APP_SUPPORT/demoforge.db-wal" "$APP_SUPPORT/demoforge.db-shm"
rm -rf "$APP_SUPPORT/captures" "$APP_SUPPORT/thumbnails"
rm -f "$APP_SUPPORT/initialized.flag"

# Clear Electron's localStorage (stored in Local Storage leveldb)
rm -rf "$APP_SUPPORT/Local Storage"

echo "Done. Next launch will be a clean first-run with the walkthrough."
