# TheBoard MVP

**TheBoard** ist eine mobile-first Social Media Plattform mit Spielautomaten-Inspiration, zentralem Video-Feed (For You Page), Gamification und einem einzigartigen Coin-System.

## 🎮 Features

### Kern-Features
- **For You Page (FYP)** – Zentraler Video-Feed (≤30s), Hashtag-basierter Algorithmus
- **Mainfeed** – Text/Bild Posts, Twitter-artig, Follow-System
- **Diskussionen** – Reddit-artiges Thread-System mit Up/Downvotes
- **Competitions** – Gamification mit Like-, Comment- und Engagement-Wettbewerben
- **Coin-System** – Bronze, Silber, Gold Coins
- **Boost-System** – Posts hervorheben mit Bronze Coins
- **Werbungssystem** – Promoted Posts mit Silber/Gold Coins

### Design
- 🕹️ Spielautomaten-inspiriertes UI mit Glow-Effekten
- 🌈 Leuchtende Neon-Farben (Cyan, Pink, Gold, Purple)
- ✨ Micro-Animations und visuelle Feedback-Effekte
- 📱 Mobile-first, max-width 480px
- 🎵 Optionale 90er Arcade-Hintergrundmusik

### Technisches
- Automatische Content-Löschung nach 30 Tagen
- Regionale/globale Filterung
- JWT-Authentifizierung
- SQLite Datenbank

## 🛠️ Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Datenbank | SQLite (better-sqlite3) |
| Auth | JWT |
| Upload | Multer |
| Jobs | node-cron |
| State | Zustand |

## 🚀 Quick Start

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm start
# API läuft auf http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App läuft auf http://localhost:3000
```

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` – Account erstellen
- `POST /api/auth/login` – Einloggen

### FYP
- `GET /api/fyp` – Feed laden (Hashtag-basiert)
- `POST /api/fyp` – Video/GIF posten
- `POST /api/fyp/:id/interact` – Interaktion (like, super_like, dislike, super_dislike, irrelevant)
- `POST /api/fyp/:id/comment` – Kommentieren

### Mainfeed
- `GET /api/mainfeed` – Feed laden
- `POST /api/mainfeed` – Text/Bild Post
- `POST /api/mainfeed/:id/interact` – Like/Dislike

### Diskussionen
- `GET /api/discussions` – Liste (sortierbar: new, top, controversial)
- `POST /api/discussions` – Neue Diskussion
- `GET /api/discussions/:id/comments` – Thread laden
- `POST /api/discussions/:id/comments` – Kommentieren
- `POST /api/discussions/:id/vote` – Up/Downvote

### Competitions
- `GET /api/competitions` – Aktive Competitions
- `POST /api/competitions/:id/enter` – Teilnehmen
- `GET /api/competitions/:id/leaderboard` – Rangliste

### Coins
- `GET /api/coins/balance` – Kontostand
- `POST /api/coins/boost` – Post boosten (Bronze)
- `POST /api/coins/advertise` – Werbung schalten (Silber/Gold)
- `POST /api/coins/convert` – Coins konvertieren

### User
- `GET /api/users/me/profile` – Eigenes Profil
- `PATCH /api/users/me` – Profil bearbeiten
- `POST /api/users/:id/follow` – User folgen
- `POST /api/users/me/hashtag-follows/:name` – Hashtag folgen

## 💰 Coin-System

| Coin | Quelle | Nutzung |
|------|--------|---------|
| 🥉 Bronze | Normale Competitions | Post boosten (10 Bronze/Tag) |
| 🥈 Silber | High-End Competitions | Werbung schalten |
| 🥇 Gold | Kaufbar | Werbung schalten |

**Wertrelation:** 1 Gold = 2 Silber = 4 Bronze

## 📱 Navigation

```
[ FYP 🎮 ] [ Mainfeed 📢 ] [ Diskussionen 💬 ] [ Profil 👾 ]
```

## 🎯 FYP Algorithmus (MVP Stage 1)

1. Lade Posts die Hashtags enthalten denen der User folgt
2. Priorisiere geboostete Posts
3. Sortiere nach Datum (neu zuerst)
4. Fallback: Alle Posts wenn keine Hashtag-Matches

## 🗑️ Auto-Löschung

- Posts werden nach **30 Tagen** automatisch gelöscht
- Stündlicher Background-Job (`node-cron`)
- Competition-Ergebnisse bleiben dauerhaft erhalten

## 🌍 Regionale Filter

- Global (alle Posts)
- EU, USA, DE, AT, CH
- Filter basieren auf Post-Metadaten (`region`, `country`, `city`)
