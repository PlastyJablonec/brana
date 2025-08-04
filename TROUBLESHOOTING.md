# 🔧 TROUBLESHOOTING - Gate Control

## 🚨 NEJČASTĚJŠÍ PROBLÉMY A ŘEŠENÍ

### 1. **MQTT používá MOCK režim místo reálné brány**

#### **Příznaky:**
- V console vidíš: `🔧 Mock MQTT: Simulace úspěšného připojení`
- Tlačítka fungují, ale brána se neovládá
- Status zobrazuje "Brána zavřena" ale není reálný

#### **Příčina:**
Aplikace automaticky přepíná na MOCK režim když:
- Chybí `REACT_APP_MQTT_URL` v `.env` souboru
- Používá se default broker IP `89.24.76.191`

#### **Řešení:**
1. **Vytvoř/uprav `.env` soubor:**
```bash
# MQTT Configuration - ZMĚŇ NA SVOU IP!
REACT_APP_MQTT_URL=ws://192.168.1.100:9001
# REACT_APP_MQTT_WSS_URL=wss://tvoje-ip:9002

# Camera Configuration
REACT_APP_CAMERA_URL=http://192.168.1.100:8080

# Firebase Configuration (zkopíruj z brana.json)
REACT_APP_FIREBASE_API_KEY=tvoj-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=brana-a71fe.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=brana-a71fe
# ... další Firebase konfigurace
```

2. **Zjisti správnou IP adresu:**
```bash
# Na Raspberry Pi:
hostname -I
# nebo
ip route | grep default
```

3. **Restartuj aplikaci:**
```bash
npm start
```

4. **Ověř v console:**
- Měl bys vidět: `🔌 Connecting to MQTT broker: ws://tvoje-ip:9001`
- NIKOLI: `🔧 Mock MQTT: Simulace...`

---

### 2. **Nový uživatel čeká na schválení, ale admin ho nevidí**

#### **Příznaky:**
- Uživatel vidí "Čekám na schválení" 
- Admin v User Management vidí uživatele jako aktivního
- Uživatel se nemůže přihlásit

#### **Příčina:**
Duplikátní záznamy uživatele v Firestore - jeden v novém systému (pending), jeden ve starém (approved).

#### **Řešení:**
✅ **OPRAVENO** - UserManagement nyní používá userService pro konzistenci.

---

### 3. **Firebase chyby - "Mock režim"**

#### **Příznaky:**
- Console: `⚠️ Firebase: Neplatná konfigurace - používám MOCK režim`
- Přihlašování nefunguje

#### **Řešení:**
Zkopíruj Firebase konfiguraci z `brana.json` do `.env`:
```bash
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=brana-a71fe.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=brana-a71fe
REACT_APP_FIREBASE_STORAGE_BUCKET=brana-a71fe.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=100155818288533404366
REACT_APP_FIREBASE_APP_ID=1:100155818288533404366:web:abc123
```

---

### 4. **MQTT se nepřipojuje - WebSocket chyby**

#### **Příznaky:**
- Console: `❌ Failed to connect to MQTT`
- WebSocket connection failed
- Status trvale "Připojuji se..."

#### **Možné příčiny a řešení:**

##### **A) Špatná IP adresa**
```bash
# Testuj ping na MQTT broker:
ping 192.168.1.100

# Testuj port:
telnet 192.168.1.100 9001
```

##### **B) Firewall blokuje port**
```bash
# Na MQTT serveru otevři porty:
sudo ufw allow 9001
sudo ufw allow 1883
```

##### **C) MQTT broker nepodporuje WebSocket**
Mosquitto musí mít v `mosquitto.conf`:
```
listener 1883
listener 9001
protocol websockets
```

##### **D) CORS problémy**
V `mosquitto.conf` přidej:
```
allow_anonymous true
# nebo nastav username/password
```

---

### 5. **Kamera se nezobrazuje**

#### **Příznaky:**
- Prázdný prostor místo kamery
- Console: chyby načítání obrázku

#### **Řešení:**
1. **Zkontroluj IP kamery v `.env`:**
```bash
REACT_APP_CAMERA_URL=http://192.168.1.100:8080
```

2. **Testuj kameru přímo:**
```bash
curl -I http://192.168.1.100:8080/camera.jpg
```

3. **CORS problémy** - kamera musí povolit přístup z webové aplikace

---

## 📋 KONTROLNÍ SEZNAM PŘED SPUŠTĚNÍM

### ✅ Před každým spuštěním ověř:

1. **`.env` soubor existuje a obsahuje:**
   - [ ] `REACT_APP_MQTT_URL=ws://skutečná-ip:9001`
   - [ ] `REACT_APP_CAMERA_URL=http://skutečná-ip:8080`
   - [ ] Firebase konfigurace (všech 6 hodnot)

2. **Síťové připojení:**
   - [ ] `ping mqtt-broker-ip` funguje
   - [ ] `ping camera-ip` funguje
   - [ ] Porty 9001 a 8080 jsou otevřené

3. **MQTT broker běží:**
   - [ ] Mosquitto service je aktivní
   - [ ] WebSocket listener na portu 9001
   - [ ] Konfigurace povoluje připojení

### 🔍 Debugging příkazy:

```bash
# Zkontroluj .env:
cat .env

# Zkontroluj síť:
hostname -I
ping mqtt-broker-ip

# Zkontroluj console logy v aplikaci:
# Developer Tools > Console
localStorage.setItem('mqtt-debug', 'true');
```

---

## 🌐 PRODUKČNÍ NASAZENÍ

### **HTTPS vs HTTP**
- **HTTP (localhost):** Používá WebSocket `ws://`
- **HTTPS (produkce):** Používá WebSocket Secure `wss://` nebo HTTP proxy

### **Environment proměnné pro produkci:**
```bash
# Pro HTTPS nasazení:
REACT_APP_MQTT_WSS_URL=wss://your-domain:9002
REACT_APP_MQTT_URL=ws://your-domain:9001
```

---

## 📞 KONTAKT PRO POMOC

Pokud problém přetrvává:

1. **Zkontroluj console logy** (F12 > Console)
2. **Zkontroluj network logy** (F12 > Network > WS)
3. **Otevři GitHub issue** s:
   - Console logy
   - Network chyby  
   - Konfigurace `.env` (bez citlivých dat)

---

*Poslední aktualizace: 2025-08-04*
*Verze: 2.14.0*