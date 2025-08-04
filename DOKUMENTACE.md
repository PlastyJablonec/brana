# Gate Control - Dokumentace aplikace

## 📋 Obsah
1. [Přehled aplikace](#přehled-aplikace)
2. [Instalace a spuštění](#instalace-a-spuštění)
3. [Architektura aplikace](#architektura-aplikace)
4. [Uživatelské role a oprávnění](#uživatelské-role-a-oprávnění)
5. [Hlavní funkce](#hlavní-funkce)
6. [Technické detaily](#technické-detaily)
7. [API a služby](#api-a-služby)
8. [Konfigurace](#konfigurace)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## 🏠 Přehled aplikace

**Gate Control** je moderní webová aplikace pro vzdálené ovládání brány a garáže pomocí MQTT protokolu. Aplikace je postavena na React TypeScript s Material Design 3 stylem a Firebase backend infrastrukturou.

### Klíčové vlastnosti:
- 🔐 **Bezpečná autentifikace** - Firebase Authentication
- 🏗️ **Moderní UI** - Material Design 3 komponenty
- 📱 **Responzivní design** - Funguje na mobilu i desktopu
- 🌐 **Real-time komunikace** - MQTT over WebSocket
- 📍 **GPS lokalizace** - Sledování polohy uživatelů
- 🎯 **Geografická omezení** - Kontrola vzdálenosti od brány
- 📊 **Monitoring aktivit** - Kompletní logování akcí
- ⚙️ **Pokročilá nastavení** - Konfigurovatelné parametry

### Verze: 2.6.0
- **Vylepšená webkamera**: Skutečný timestamp snímků místo času načtení
- **Realistické zobrazení času**: "Před Xs" místo zavádějícího "Nyní"
- **HTTP Last-Modified**: Inteligentní detekce stáří snímků z kamerového serveru
- **Fallback mechanismus**: Konzervativní odhad při nedostupnosti metadat
- **Lepší UX při pomalém připojení**: Uživatel vidí reálné stáří zobrazovaného snímku

### Předchozí verze: 2.5.1
- Přidáno NICK pole pro uživatele
- Implementována geografická omezení s moderním UI
- Vylepšené blikání timeru
- Nové nastavení polohy brány
- Detail dialogy pro logy s GPS souřadnicemi a vzdáleností
- Zvukový feedback pro všechny akce
- Cleanup funkce pro správu logů
- Opraveno resetování časů při reconnectu
- Zlepšené UX pro geografická omezení (šedá tlačítka místo alertů)

---

## 🚀 Instalace a spuštění

### Předpoklady
- Node.js 16+ 
- npm nebo yarn
- Git
- Firebase projekt
- MQTT broker

### ⚠️ KRITICKÉ - Konfigurace před spuštěním

**🚨 BEZ SPRÁVNÉ KONFIGURACE APLIKACE BĚŽÍ V MOCK REŽIMU!**

```bash
# Klonování repository
git clone https://github.com/PlastyJablonec/brana.git
cd gate-control

# Instalace závislostí
npm install

# POVINNÉ: Konfigurace .env souboru
cp .env.example .env

# DŮLEŽITÉ: Uprav .env s reálnými IP adresami:
nano .env
```

**Viz detailní návod:** [KONFIGURACE.md](./KONFIGURACE.md)

### Lokální vývoj

```bash
# Po dokončení konfigurace .env:
npm start
```

**📋 Kompletní troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Produkční build

```bash
# Build aplikace
npm run build

# Deploy (podle vašeho prostředí)
npm run deploy
```

---

## 🏗️ Architektura aplikace

### Struktura složek

```
src/
├── components/          # Znovupoužitelné UI komponenty
│   ├── AppFooter.tsx   # Footer s build informacemi
│   ├── CameraView.tsx  # Komponenta pro webkameru
│   ├── ErrorBoundary.tsx
│   ├── LoadingSpinner.tsx
│   ├── MqttErrorBoundary.tsx
│   └── ThemeToggle.tsx
├── contexts/           # React Context providers
│   ├── AuthContext.tsx # Autentifikace uživatelů
│   └── ThemeContext.tsx # Správa témat
├── hooks/              # Custom React hooks
│   └── useGateTimer.tsx # Timer logika pro bránu
├── pages/              # Hlavní stránky aplikace
│   ├── Dashboard.tsx   # Hlavní ovládací panel
│   ├── LoginPage.tsx   # Přihlašovací stránka
│   ├── UserManagement.tsx # Správa uživatelů
│   ├── ActivityLogs.tsx # Logy aktivit
│   └── Settings.tsx    # Nastavení systému
├── services/           # Business logika a API
│   ├── mqttService.ts  # MQTT komunikace
│   ├── locationService.ts # GPS služby
│   ├── distanceService.ts # Výpočty vzdáleností
│   ├── activityService.ts # Logování aktivit
│   ├── settingsService.ts # Správa nastavení
│   └── lastUserService.ts # Sledování posledního uživatele
├── types/              # TypeScript definice
│   └── index.ts
├── firebase/           # Firebase konfigurace
│   └── config.ts
└── styles/             # CSS styly
    └── global.css
```

### Datový tok

```
User Interface → React Components → Services → Firebase/MQTT → Hardware
```

---

## 👥 Uživatelské role a oprávnění

### Role

#### **Admin**
- Plný přístup ke všem funkcím
- Správa uživatelů a nastavení
- Přístup k logům a monitoringu

#### **User** 
- Ovládání brány a garáže
- Zobrazení kamerových záznamů
- Základní monitoring

#### **Viewer**
- Pouze zobrazení stavu
- Přístup ke kameře
- Žádné ovládací oprávnění

### Oprávnění (detailní)

| Oprávnění | Popis | Admin | User | Viewer |
|-----------|-------|-------|------|--------|
| `gate` | Ovládání brány | ✅ | ✅ | ❌ |
| `garage` | Ovládání garáže | ✅ | ✅ | ❌ |
| `camera` | Přístup ke kameře | ✅ | ✅ | ✅ |
| `stopMode` | STOP režim | ✅ | ❌ | ❌ |
| `viewLogs` | Zobrazení logů | ✅ | ✅ | ✅ |
| `manageUsers` | Správa uživatelů | ✅ | ❌ | ❌ |
| `requireLocation` | Vyžadovat GPS | ✅ | ✅ | ✅ |
| `allowGPS` | Povolit GPS | ✅ | ✅ | ✅ |
| `requireLocationProximity` | Omezení vzdálenosti | ✅ | ✅ | ❌ |

---

## ⚡ Hlavní funkce

### 1. 🚪 Ovládání brány

**Funkce:**
- Otevření/zavření brány jedním klikem
- Automatické zavírání po nastavené době
- Timer zobrazující stav (pohyb, čekání, auto-zavření)
- STOP režim pro nouzové zastavení

**Technické detaily:**
- MQTT topic: `brana/prikaz`
- Timer stavy: travel → open → auto-close → closed
- Vizuální feedback s blikáním při kritických stavech

### 2. 🏠 Ovládání garáže

**Funkce:**
- Nezávislé ovládání garáže
- Sledování stavu otevřeno/zavřeno
- Logování všech akcí

**Technické detaily:**
- MQTT topic: `garaz/prikaz`
- Samostatný status monitoring

### 3. 📹 Webkamera

**Funkce:**
- Live stream z kamery s přesným timestampem pořízení
- Automatické obnovování snímků každých 5 sekund
- Realistické zobrazení stáří snímku ("Před Xs" / "Před Xm")
- Inteligentní detekce času pořízení z HTTP Last-Modified headerů
- Offline detekce a fallback mechanismy

**Technické detaily:**
- URL: konfigurovatelná v kódu
- Refresh interval: 5 sekund
- Timestamp detection: HTTP HEAD request pro Last-Modified
- Fallback: konzervativní odhad (čas požadavku - refresh interval)
- Nikdy nezobrazuje zavádějící "Nyní" - minimálně "Před 1s"

### 4. 📍 GPS a geografická omezení

**Funkce:**
- Automatické sledování polohy uživatelů
- Omezení přístupu podle vzdálenosti od brány
- Konfigurovatelná maximální vzdálenost
- Fallback pro desktop bez GPS

**Implementace:**
```typescript
// Kontrola vzdálenosti
const distance = distanceService.calculateDistance(userLocation, gateLocation);
const isAllowed = distance <= maxDistanceMeters;
```

### 5. 👤 Správa uživatelů

**Funkce:**
- Přidávání/upravování uživatelů
- Nastavení rolí a oprávnění
- NICK pole pro identifikaci v logách
- GPS informace pro každého uživatele
- Refresh GPS tlačítko

### 6. 📊 Monitoring a logy

**Funkce:**
- Kompletní historie akcí
- Filtrování podle data, uživatele, zařízení
- Export dat
- Real-time sledování posledního uživatele

### 7. ⚙️ Pokročilá nastavení

**Funkce:**
- Časování brány (pohyb, auto-zavření)
- Poloha brány a maximální vzdálenost
- Nastavení zobrazení posledního uživatele
- GPS testování a diagnostika

---

## 🔧 Technické detaily

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material Design 3** - Design systém
- **React Query** - Data fetching
- **React Router** - Routing

### Backend Services
- **Firebase Auth** - Autentifikace
- **Firestore** - NoSQL databáze
- **MQTT over WebSocket** - Real-time komunikace

### Key Libraries

```json
{
  "@tanstack/react-query": "^5.84.0",
  "firebase": "^9.23.0",
  "mqtt": "^4.3.7",
  "react": "^18.3.1",
  "react-router-dom": "^6.28.1"
}
```

### Build systém

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "node set-build-info.js && react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### Git Integration
- Automatické generování build info z git
- Verze, commit hash, timestamp v aplikaci

---

## 🌐 API a služby

### MQTT Topics

| Topic | Směr | Popis |
|-------|------|-------|
| `brana/prikaz` | → | Příkazy pro bránu |
| `brana/stav` | ← | Stav brány |
| `garaz/prikaz` | → | Příkazy pro garáž |
| `garaz/stav` | ← | Stav garáže |
| `Log/Brana/ID` | → | Logování uživatelských akcí |

### Firebase Collections

#### `users`
```typescript
{
  id: string;
  email: string;
  displayName: string;
  nick?: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: {
    gate: boolean;
    garage: boolean;
    camera: boolean;
    stopMode: boolean;
    viewLogs: boolean;
    manageUsers: boolean;
    requireLocation: boolean;
    allowGPS: boolean;
    requireLocationProximity: boolean;
  };
  lastLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  createdAt: Date;
  lastLogin: Date;
}
```

#### `activities`
```typescript
{
  id: string;
  user: string;
  userDisplayName: string;
  action: string;
  device: 'gate' | 'garage';
  status: 'success' | 'error';
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  details?: string;
}
```

#### `settings/app_settings`
```typescript
{
  gate: {
    travelTime: number; // sekundy
    autoCloseTime: number; // sekundy
    stopModeEnabled: boolean;
    notificationsEnabled: boolean;
  };
  location: {
    gateLatitude: number;
    gateLongitude: number;
    maxDistanceMeters: number;
  };
  lastUser: {
    showLastUser: boolean;
    allowedRoles: string[];
    maxAgeHours: number;
  };
}
```

### Services API

#### `mqttService`
```typescript
// Připojení k MQTT
await mqttService.connect();

// Odeslání příkazu
await mqttService.publishGateCommand(userEmail);
await mqttService.publishGarageCommand(userEmail);

// Sledování stavu
mqttService.onStatusChange((status) => {
  console.log(status.gateStatus, status.garageStatus);
});
```

#### `locationService`
```typescript
// Získání aktuální polohy
const location = await locationService.getCurrentLocation();

// Sledování polohy
await locationService.startWatching();

// Kontrola dostupnosti
const isSupported = locationService.isLocationSupported();
```

#### `distanceService`
```typescript
// Výpočet vzdálenosti
const distance = distanceService.calculateDistance(coord1, coord2);

// Kontrola v povoleném rozsahu
const isAllowed = distanceService.isWithinAllowedDistance(
  userLocation, 
  gateLocation, 
  maxDistance
);
```

---

## ⚙️ Konfigurace

### Environment Variables

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# MQTT Configuration  
REACT_APP_MQTT_BROKER=ws://your-broker:8083/mqtt
REACT_APP_MQTT_USERNAME=username
REACT_APP_MQTT_PASSWORD=password

# Build info (automaticky generováno)
REACT_APP_BUILD_TIME=2025-01-XX...
REACT_APP_VERSION=2.2.0
REACT_APP_COMMIT_HASH=abc123...
```

### Firebase Rules

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.uid == userId || 
         isAdmin(request.auth.uid));
    }
    
    // Activities collection
    match /activities/{activityId} {
      allow read: if request.auth != null && 
        hasPermission(request.auth.uid, 'viewLogs');
      allow create: if request.auth != null;
    }
    
    // Settings collection
    match /settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        isAdmin(request.auth.uid);
    }
    
    function isAdmin(userId) {
      return get(/databases/$(database)/documents/users/$(userId))
        .data.permissions.manageUsers == true;
    }
    
    function hasPermission(userId, permission) {
      return get(/databases/$(database)/documents/users/$(userId))
        .data.permissions[permission] == true;
    }
  }
}
```

#### Authentication Rules
```javascript
// Pouze email/password autentifikace
// Registrace pouze pro administrátory
```

### MQTT Broker Setup

```yaml
# mosquitto.conf
listener 1883
listener 8083
protocol websockets

allow_anonymous false
password_file /etc/mosquitto/passwd

# Security
max_connections 100
max_inflight_messages 10
```

---

## 🚀 Deployment

### Vercel (Doporučeno)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Environment variables nastavte v Vercel dashboardu
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

---

## 🐛 Troubleshooting

### Běžné problémy

#### 1. **MQTT se nepřipojuje**

**Příznaky:**
- Status "Připojuji se..." trvale
- Chybové hlášky v konzoli

**Řešení:**
```typescript
// Zkontrolujte MQTT konfiguraci
console.log('MQTT Broker:', process.env.REACT_APP_MQTT_BROKER);

// Ověřte WebSocket podporu brokeru
// Broker musí podporovat WebSocket na portu 8083
```

#### 2. **GPS nefunguje**

**Příznaky:**
- "GPS nedostupné" hlášky
- Fallback na Praha centrum

**Řešení:**
```bash
# Musí běžet na HTTPS nebo localhost
# Zkontrolujte browser permissions
# Test GPS v Settings > GPS Informace
```

#### 3. **Firebase autentifikace selhává**

**Příznaky:**
- Nekonečné načítání na login
- "Auth domain not authorized"

**Řešení:**
```javascript
// Zkontrolujte Firebase config
// Přidejte domain do Authorized domains
// Ověřte API keys
```

#### 4. **Build informace se nezobrazují**

**Příznaky:**
- Verze "Unknown" v footeru
- Chybí git informace

**Řešení:**
```bash
# Zkontrolujte že set-build-info.js běží před buildem
npm run build

# Manually run build info script
node set-build-info.js
```

### Debug módy

#### Console Logging
```typescript
// Zapnout verbose logging
localStorage.setItem('debug', 'true');

// MQTT debug
localStorage.setItem('mqtt-debug', 'true');

// GPS debug  
localStorage.setItem('gps-debug', 'true');
```

#### Network Monitoring
```bash
# MQTT WebSocket monitoring
# Otevřete Developer Tools > Network > WS

# Firebase monitoring
# Developer Tools > Application > Firebase
```

### Performance Optimalizace

#### Bundle Velikost
```bash
# Analyzujte bundle
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js
```

#### Memory Leaks
```typescript
// Cleanup useEffect hooks
useEffect(() => {
  const subscription = service.subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 📞 Podpora

### Kontakty
- **Vývojář:** Váš tým
- **Repository:** https://github.com/vas-repo/gate-control
- **Issues:** https://github.com/vas-repo/gate-control/issues

### Changelog

#### v2.6.0 (2025-01-02)
- ✨ **Nové funkce:**
  - Skutečný timestamp snímků z webkamery
  - Realistické zobrazení času "Před Xs" místo "Nyní"
  - HTTP Last-Modified detekce stáří snímků
  - Lepší UX při pomalém připojení
  
- 🔧 **Technické změny:**
  - Async refreshCamera() funkce
  - HTTP HEAD request pro metadata
  - Fallback mechanismus pro timestamp
  - Konzervativní odhad stáří snímků

#### v2.5.1 (2025-01-XX)
- ✨ **Nové funkce:**
  - NICK pole pro uživatele
  - Geografická omezení přístupu
  - Nastavení polohy brány v UI
  - Vylepšené blikání timeru
  
- 🔧 **Technické změny:**
  - Nový distanceService
  - Rozšířené User interface
  - Aktualizované Settings stránka
  - Kontrola vzdálenosti před příkazy

#### v2.1.0 (2025-01-XX)
- 🐛 **Opravy:**
  - Stabilnější GPS implementace
  - Lepší error handling
  - Opravené build informace

#### v2.0.0 (2024-XX-XX)
- 🎉 **Major release:**
  - Kompletní přepis na React + TypeScript
  - Material Design 3
  - Firebase backend
  - MQTT over WebSocket

---

## 📚 Další zdroje

### Dokumentace technologií
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Docs](https://firebase.google.com/docs)
- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)
- [Material Design 3](https://m3.material.io/)

### Tools
- [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/)
- [Firebase DevTools](https://chrome.google.com/webstore/detail/firebase-devtools/)
- [MQTT Explorer](http://mqtt-explorer.com/)

---

*Dokumentace aktualizována: 2025-01-02*
*Verze aplikace: 2.6.0*