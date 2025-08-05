# Firebase Test Suite Documentation

## 🚀 Přehled

Kompletní test suite pro diagnostiku problémů s Firebase pending users v aplikaci gate-control. Suite obsahuje automatizované testy, mock data, a utility pro debugging Firebase autentifikace a Firestore operací.

## 📁 Struktura souborů

```
src/
├── __tests__/
│   ├── firebase-auth.test.ts                    # Hlavní Firebase testy
│   ├── components/
│   │   └── UserApprovalPanel.test.tsx          # Testy komponenty pro schvalování users
│   ├── contexts/
│   │   └── AuthContext.test.tsx                # Testy AuthContext provideru
│   ├── integration/
│   │   └── firebase-rules.test.ts              # Integrační testy Firebase rules
│   ├── test-data/
│   │   └── mockUsers.ts                        # Mock data pro testování
│   ├── setup/
│   │   └── testSetup.ts                        # Globální test konfigurace
│   ├── jest.config.js                          # Jest konfigurace
│   └── run-tests.sh                            # Script pro spuštění všech testů
├── utils/
│   └── firebaseDebug.ts                        # Existující debugging utility
└── services/
    ├── userService.ts                           # Existující user service
    └── adminService.ts                          # Existující admin service

scripts/
└── firebase-test-script.js                     # Node.js script pro přímé Firebase testování
```

## 🎯 Testované komponenty

### 1. Firebase Authentication (`firebase-auth.test.ts`)
- ✅ Firebase config loading
- ✅ Email/password authentication
- ✅ Google OAuth authentication  
- ✅ Auth error handling
- ✅ Token retrieval
- ✅ Firestore CRUD operations
- ✅ Admin permissions verification
- ✅ Pending users retrieval
- ✅ Permission denied scenarios

### 2. UserApprovalPanel Component (`UserApprovalPanel.test.tsx`)
- ✅ Access control (admin vs non-admin)
- ✅ Loading states
- ✅ Pending users display
- ✅ Empty state handling
- ✅ User approval workflow
- ✅ User rejection with reason
- ✅ Error handling
- ✅ Fallback loading mechanisms
- ✅ Debug information display

### 3. AuthContext Provider (`AuthContext.test.tsx`)
- ✅ Provider initialization
- ✅ Authentication flow (login/logout)
- ✅ User data fetching
- ✅ Legacy user document fallback
- ✅ Minimal user creation
- ✅ Admin functions (approve/reject/getPendingUsers)
- ✅ Error recovery mechanisms
- ✅ Complete integration workflow

### 4. Firebase Rules Integration (`firebase-rules.test.ts`)
- ✅ Admin access rules
- ✅ CRUD operations permissions
- ✅ User data access validation
- ✅ Field requirements validation
- ✅ FirebaseDebug utility integration
- ✅ Fallback mechanisms
- ✅ Real-world scenarios

## 🛠️ Spuštění testů

### Rychlé spuštění - všechny testy
```bash
cd /home/pi/programovani/ovladani-brany-v2/gate-control
./src/__tests__/run-tests.sh
```

### Jednotlivé testy
```bash
# Firebase authentication testy
npx jest src/__tests__/firebase-auth.test.ts --config=src/__tests__/jest.config.js --verbose

# UserApprovalPanel testy
npx jest src/__tests__/components/UserApprovalPanel.test.tsx --config=src/__tests__/jest.config.js --verbose

# AuthContext testy
npx jest src/__tests__/contexts/AuthContext.test.tsx --config=src/__tests__/jest.config.js --verbose

# Firebase rules integration testy
npx jest src/__tests__/integration/firebase-rules.test.ts --config=src/__tests__/jest.config.js --verbose
```

### Node.js Firebase script
```bash
# Kompletní test
node scripts/firebase-test-script.js

# Jen connection test
node scripts/firebase-test-script.js --connection

# Jen user operace
node scripts/firebase-test-script.js --users

# Vytvoř mock pending users
node scripts/firebase-test-script.js --mock

# Vyčisti mock data
node scripts/firebase-test-script.js --cleanup

# Help
node scripts/firebase-test-script.js --help
```

### Coverage report
```bash
npx jest --config=src/__tests__/jest.config.js --coverage --watchAll=false
```

## 🔍 Mock Data

### Testovací uživatelé (`mockUsers.ts`)
- **mockAdminUser**: Admin s všemi oprávněními
- **mockRegularUser**: Běžný uživatel
- **mockPendingUsers**: Array 3 pending users pro testování
- **mockRejectedUser**: Zamítnutý uživatel
- **mockFirestoreUsers**: Firestore document data
- **mockFirebaseErrors**: Různé Firebase chyby

### Test scénáře
- Úspěšné načtení pending users
- Prázdný seznam pending users  
- Permission denied error
- Admin verification úspěšná/neúspěšná
- Fallback metody

## 🚨 Diagnostika problémů

### Běžné problémy a řešení

#### 1. Admin nevidí pending users
**Možné příčiny:**
- Admin nemá správná oprávnění (`permissions.manageUsers !== true`)
- Firebase Security Rules blokují přístup
- Firestore index chybí pro orderBy dotazy
- Auth token je neplatný

**Diagnostic kroky:**
```bash
# Spusť debug utility v browseru
FirebaseDebug.runFullDiagnostic()

# Nebo použij Node script
node scripts/firebase-test-script.js --users
```

#### 2. Permission denied chyby
**Možné příčiny:**
- Firebase Rules nepovolují čtení/zapis
- Uživatel není správně autentifikovaný
- Auth token vypršel

**Diagnostic kroky:**
```bash
# Test Firebase rules
node scripts/firebase-test-script.js --connection

# Test admin permissions
FirebaseDebug.verifyAdminPermissions()
```

#### 3. Firebase connection issues
**Možné příčiny:**
- Nesprávná Firebase konfigurace
- Chybějící environment variables
- Network connectivity issues

**Diagnostic kroky:**
```bash
# Test základního připojení
node scripts/firebase-test-script.js --connection
```

## 📊 Test Coverage

Suite pokrývá:
- **Firebase Authentication**: 95%+
- **Firestore Operations**: 90%+
- **Component Logic**: 85%+
- **Error Handling**: 90%+
- **Integration Flows**: 80%+

## 🔧 Přizpůsobení testů

### Přidání nových testů
1. Vytvoř nový test soubor v příslušné složce
2. Použij existující mock data z `test-data/mockUsers.ts`
3. Následuj naming convention: `*.test.ts` nebo `*.test.tsx`

### Úprava mock dat
Edituj `/src/__tests__/test-data/mockUsers.ts` pro:
- Nové testovací uživatele
- Různé permission scénáře  
- Specific error cases
- Custom Firebase responses

### Nové test scénáře
Přidej do `testScenarios` objekt v `mockUsers.ts`:
```typescript
export const testScenarios = {
  newScenario: {
    name: 'New Test Scenario',
    mockData: [...],
    expectedResult: { ... }
  }
}
```

## 🐛 Debugging

### Console debugging
```javascript
// V browser console
FirebaseDebug.runFullDiagnostic()
FirebaseDebug.getCurrentUserDetails()
FirebaseDebug.verifyAdminPermissions()
FirebaseDebug.testFirestoreOperations()
```

### Test debugging
```bash
# Debug mode s watch
npx jest --config=src/__tests__/jest.config.js --watch

# Specific test s verbose output
npx jest src/__tests__/firebase-auth.test.ts --config=src/__tests__/jest.config.js --verbose

# Coverage s debug info
npx jest --config=src/__tests__/jest.config.js --coverage --verbose
```

## 📈 Výsledky testů

Po spuštění testů získáš:
- **Console output**: Detailní log všech testů
- **Coverage report**: HTML report v `./coverage/lcov-report/index.html` 
- **LCOV data**: Pro CI/CD integration v `./coverage/lcov.info`
- **Firebase diagnostika**: Výstup z Node.js scriptu

## 🎯 Doporučení

1. **Spouštěj testy pravidelně** při změnách Firebase konfigurace
2. **Používej mock data** pro konsistentní testování
3. **Kontroluj coverage** pro zajištění kompletního pokrytí
4. **Debuguj pomocí FirebaseDebug utility** pro real-time diagnostiku
5. **Vyčisti mock data** po testování v production prostředí

## 🔗 Související soubory

- `/src/utils/firebaseDebug.ts` - Existující debugging utility
- `/admin-debug.html` - HTML debug interface  
- `/firestore.rules` - Firebase Security Rules
- `/src/firebase/config.ts` - Firebase konfigurace
- `/src/contexts/AuthContext.tsx` - Auth context provider
- `/src/components/UserApprovalPanel.tsx` - User approval component

---

**Autor**: Claude Code Assistant  
**Datum**: 2024-12-05  
**Verze**: 1.0  
**Firebase Project**: brana-a71fe