# Gate Control System

Moderní webová aplikace pro ovládání brány a garáže s Firebase autentifikací a MQTT komunikací.

## Funkce

- 🔐 Firebase autentifikace
- 🚪 Ovládání brány a garáže přes MQTT
- 📷 Live webkamera s timestamp
- 📊 Monitoring aktivit s GPS lokací
- 👥 Správa uživatelů a oprávnění
- 📱 Responsivní Material Design 3
- 📍 GPS sledování uživatelů (vyžaduje HTTPS)
- 🕒 Sledování posledního uživatele brány

## Technologie

- React 19 + TypeScript
- Firebase Auth & Firestore
- MQTT.js pro IoT komunikaci
- Modern CSS (Glass morphism design)

## Instalace

1. **Klonujte repozitář:**
   ```bash
   git clone <repository-url>
   cd gate-control
   ```

2. **Nainstalujte závislosti:**
   ```bash
   npm install
   ```

3. **Nakonfigurujte environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Editujte `.env` soubor s vašimi hodnotami:
   - Firebase konfigurace z Firebase Console
   - MQTT broker URL (ws://ip:port)
   - Camera URL (http://ip:port)

4. **Nastavte Firebase projekt:**
   - Vytvořte projekt ve Firebase Console
   - Aktivujte Authentication (Email/Password)
   - Aktivujte Firestore Database

5. **Pro GPS funkčnost:**
   - Aplikace vyžaduje HTTPS protokol pro GPS
   - Pro vývoj: použijte `localhost` (GPS funguje)
   - Pro produkci: nasaďte na HTTPS server
   - Vytvořte users kolekci s příslušnými oprávněními

## Spuštění

### Development
```bash
npm start
```

### Production Build
```bash
npm run build
npm install -g serve
serve -s build -p 3000
```

## Struktura uživatelských oprávnění

V Firestore vytvořte dokument v kolekci `users` s následující strukturou:

```json
{
  "email": "user@example.com",
  "displayName": "John Doe",
  "role": "admin",
  "permissions": {
    "gate": true,
    "garage": true,
    "camera": true,
    "stopMode": true,
    "viewLogs": true,
    "manageUsers": true,
    "requireLocation": false
  },
  "gpsEnabled": false,
  "createdAt": "2025-07-30T00:00:00.000Z",
  "lastLogin": "2025-07-30T00:00:00.000Z"
}
```

## MQTT Témata

- **Příkazy:** `IoT/Brana/Ovladani`
  - `1` - Ovládání brány
  - `3` - Ovládání garáže  
  - `6` - STOP režim

- **Stavy:**
  - `IoT/Brana/Status` - Stav brány
  - `IoT/Brana/Status2` - Stav garáže

## Deployment

1. **Build aplikace:**
   ```bash
   npm run build
   ```

2. **Nasaďte na web server** (Apache/Nginx)

3. **Nastavte proxy pro MQTT WebSocket** (pokud potřebujete)

## ⚠️ DŮLEŽITÉ - PŘED SPUŠTĚNÍM!

**🚨 APLIKACE POUŽÍVÁ MOCK REŽIM POKUD NENÍ SPRÁVNĚ NAKONFIGUROVÁNA!**

1. **Zkopíruj a uprav `.env` soubor:**
   ```bash
   cp .env.example .env
   ```

2. **Nastav SKUTEČNÉ IP adresy v `.env`:**
   ```bash
   # MQTT Configuration - ZMĚŇ NA SVOU IP!
   REACT_APP_MQTT_URL=ws://192.168.1.100:9001
   
   # Camera Configuration - ZMĚŇ NA SVOU IP!  
   REACT_APP_CAMERA_URL=http://192.168.1.100:8080
   
   # Firebase Configuration (zkopíruj z brana.json)
   REACT_APP_FIREBASE_PROJECT_ID=brana-a71fe
   # ... další Firebase konfigurace
   ```

3. **Bez této konfigurace NEBUDEŠ MOCT OVLÁDAT SKUTEČNOU BRÁNU!**

📋 **Kompletní troubleshooting:** Viz [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## Troubleshooting

- **MQTT mock režim:** Chybí `REACT_APP_MQTT_URL` v `.env` → Viz [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Firebase chyby:** Chybí Firebase konfigurace v `.env` souboru
- **Kamera nefunguje:** Zkontrolujte IP kamery v `.env` a CORS nastavení

## Licence

Private project - All rights reserved# Test deployment trigger
# Trigger redeploy Thu  4 Sep 15:02:50 CEST 2025
