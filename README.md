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

## Troubleshooting

- **MQTT se nepřipojuje:** Zkontrolujte firewall a WebSocket podporu brokeru
- **Firebase chyby:** Ověřte konfigurace v .env souboru  
- **Kamera nefunguje:** Zkontrolujte CORS nastavení camera serveru

## Licence

Private project - All rights reserved