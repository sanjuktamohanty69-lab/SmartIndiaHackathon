#!/bin/bash
echo "Installing backend dependencies..."
cd server
npm install-scripts approve better-sqlite3
npm install

echo "Installing frontend dependencies..."
cd ../client
npm install

echo "Installing root tools..."
cd ..
npm install concurrently

echo "Setup complete! Run 'npm run dev' to start the whole app."