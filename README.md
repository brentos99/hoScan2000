# hoScan2000 - Stocktake Scanner System

A mobile stocktake/inventory scanning system with offline-first architecture, designed for Android devices with hardware barcode scanners (CipherLab RS35).

## Features

- **Offline-first operation** - Scan without network, sync when connected
- **Hardware barcode scanner support** - CipherLab RS35, Zebra, and keyboard wedge mode
- **Area-based scanning** - Divide stocktakes into sections for multiple devices
- **PIN authentication** - Simple PIN code to join stocktakes
- **Real-time sync** - Background sync with server when online
- **Barcode validation** - Validate scans against downloaded master file

## Project Structure

```
src/
├── hoScan2000.app/       # React Native/Expo mobile app
└── hoScan2000.server/    # Node.js/Fastify API server
```

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- Android device or emulator
- Expo CLI (`npm install -g expo-cli`)

## Quick Start

### 1. Start the Database

```bash
cd src/hoScan2000.server
docker compose up -d
```

This starts PostgreSQL on `localhost:5432`.

### 2. Set Up the Server

```bash
cd src/hoScan2000.server
npm install
npm run db:push    # Create database tables
npm run db:seed    # Add sample data
npm run dev        # Start server on port 3000
```

The server will be running at `http://localhost:3000`.

### 3. Start the Mobile App

```bash
cd src/hoScan2000.app
npm install
npx expo start --android
```

### 4. Connect and Test

1. Open the app on your device/emulator
2. Enter your server URL (e.g., `http://192.168.1.100:3000`)
3. Enter a device name
4. Go to **Stocktakes** tab
5. Join "Test Stocktake" with PIN: **1234**
6. Select an area and start scanning!

## Sample Data

The seed script creates:
- **Store**: "Main Warehouse" (WH01)
- **Stocktake**: "Test Stocktake" with PIN `1234`
- **Areas**: Aisle 1, Aisle 2, Aisle 3, Back Room
- **Sample barcodes**: 5 test EAN-13 barcodes

## Server Commands

```bash
cd src/hoScan2000.server

# Development
npm run dev           # Start dev server with hot reload

# Database
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:seed       # Seed sample data
npm run db:studio     # Open Prisma Studio GUI

# Production
npm run build         # Build TypeScript
npm start             # Start production server
```

## Docker Commands

```bash
cd src/hoScan2000.server

docker compose up -d      # Start PostgreSQL
docker compose down       # Stop (keeps data)
docker compose down -v    # Stop and delete all data
docker compose logs -f    # View logs
```

## API Endpoints

### Stores
- `GET /api/v1/stores` - List stores
- `GET /api/v1/stores/:id` - Get store details

### Master File
- `GET /api/v1/stores/:storeId/master` - Get master file info
- `GET /api/v1/stores/:storeId/master/download` - Download full master file
- `POST /api/v1/stores/:storeId/master` - Upload master file

### Stocktakes
- `GET /api/v1/stocktakes` - List stocktakes
- `POST /api/v1/stocktakes` - Create stocktake
- `GET /api/v1/stocktakes/:id` - Get stocktake details
- `POST /api/v1/stocktakes/:id/join` - Join with PIN
- `POST /api/v1/stocktakes/:id/start` - Start stocktake
- `POST /api/v1/stocktakes/:id/complete` - Complete stocktake

### Areas
- `GET /api/v1/stocktakes/:id/areas` - List areas
- `POST /api/v1/stocktakes/:id/areas/:areaId/claim` - Claim area
- `POST /api/v1/stocktakes/:id/areas/:areaId/release` - Release area

### Scans
- `POST /api/v1/stocktakes/:id/scans` - Upload scans (batch)
- `GET /api/v1/stocktakes/:id/scans` - Get scans
- `GET /api/v1/stocktakes/:id/export/csv` - Export as CSV

### Devices
- `POST /api/v1/devices/register` - Register device

## Hardware Scanner Configuration

### CipherLab RS35

The app listens for CipherLab barcode intents automatically:
- Intent action: `com.cipherlab.barcode.ACTION`
- No additional configuration needed

### Zebra (DataWedge)

Configure DataWedge to send intents:
- Intent action: `com.hoscan2000.SCAN`
- Intent delivery: Broadcast intent

### Keyboard Wedge Mode

For scanners that emulate keyboard input:
- The app detects rapid character input followed by Enter
- Works as a fallback for any scanner type

## Mobile App Settings

- **Use Camera Scanner** - Toggle between hardware scanner and camera
- **Sound** - Enable/disable scan sounds
- **Vibration** - Enable/disable haptic feedback

## Environment Variables

Server (`.env`):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hoscan2000
PORT=3000
HOST=0.0.0.0
CORS_ORIGINS=*
LOG_LEVEL=info
```

## Tech Stack

### Server
- Node.js + TypeScript
- Fastify (web framework)
- Prisma (ORM)
- PostgreSQL (database)
- Zod (validation)

### Mobile App
- React Native + Expo
- TypeScript
- Expo SQLite (offline storage)
- Zustand (state management)
- Expo Router (navigation)

## Offline Architecture

1. **All scans stored locally first** (SQLite)
2. **Barcode validation uses in-memory cache** for speed
3. **Background sync** pushes to server when online
4. **Idempotency keys** prevent duplicate uploads
5. **Sync queue** (outbox pattern) for reliable delivery

## License

MIT
