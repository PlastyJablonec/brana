# Railway Deployment Guide

## 🚀 Deploy na Railway

### 1. **Frontend Deployment**
```bash
# Frontend (React App)
Root Directory: /
Build Command: npm run build
Start Command: npm start
Port: 3000
```

### 2. **Backend Deployment** 
```bash
# Backend (Express + Camera API)
Root Directory: /backend
Build Command: npm run build
Start Command: npm start
Port: 3001
```

### 3. **Environment Variables**

#### Frontend:
```
REACT_APP_CAMERA_URL=https://your-backend.railway.app/api/camera/main-camera/snapshot
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

#### Backend:
```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### 4. **Deploy Steps**

1. **Připoj GitHub repo** na Railway.app
2. **Vytvoř dva services:**
   - `brana-frontend` (root dir: `/`)
   - `brana-backend` (root dir: `/backend`)
3. **Nastav environment variables**
4. **Deploy automatically** z Git

### 5. **Railway URLs**
- Frontend: `https://brana-frontend.railway.app`
- Backend: `https://brana-backend.railway.app`
- Camera API: `https://brana-backend.railway.app/api/camera`

### 6. **Enterprise Camera Mode**
- URL: `https://brana-frontend.railway.app/?backend=true`
- API: `https://brana-backend.railway.app/api/camera/main-camera/snapshot`

## 🎯 **Benefits vs Vercel:**

✅ **Backend support** - Express server  
✅ **No serverless limits** - dlouhé HTTP requesty OK  
✅ **Database support** - PostgreSQL pokud potřeba  
✅ **Docker support** - plná kontrola  
✅ **Reasonable pricing** - $5/měsíc  

## 🔧 **Next Steps:**
1. Registruj se na Railway.app
2. Připoj GitHub repo  
3. Vytvoř dva services
4. Nastav environment variables
5. Deploy! 🚀