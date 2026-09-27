# WuWa Thai Duel 🃏

เกมไพ่ดวลสไตล์ไทยสำหรับ Wuthering Waves — เล่นได้ทั้งแบบ 1v1 ออนไลน์และสู้กับ AI

> ดูกฎการเล่นฉบับเต็มได้ที่ [RULES-TH.md](./RULES-TH.md)

---

## 🛠️ Tech Stack

| ส่วน | เทคโนโลยี |
|------|------------|
| Frontend | [Vite](https://vitejs.dev/) + TypeScript + Tailwind CSS v4 |
| Backend | Node.js + TypeScript (รันด้วย `tsx`) |
| Type System | TypeScript (strict mode) |
| Linting | ESLint + typescript-eslint |
| Formatting | Prettier |
| Testing | Node.js built-in test runner (`tsx --test`) |

---

## 📦 สิ่งที่ต้องติดตั้ง

### ข้อกำหนดเบื้องต้น

| โปรแกรม | เวอร์ชันขั้นต่ำ | ดาวน์โหลด |
|---------|--------------|-----------|
| **Node.js** | `>= 22` | [nodejs.org](https://nodejs.org/) |
| **npm** | มาพร้อม Node.js | — |
| **Git** | ใดก็ได้ | [git-scm.com](https://git-scm.com/) |

### ติดตั้ง Dependencies

```bash
# Clone โปรเจกต์
git clone https://github.com/AtirujRat/WuWa-Thai-Duel.git
cd WuWa-Thai-Duel

# ติดตั้ง packages ทั้งหมด
npm install
```

---

## 🚀 วิธีรัน

โปรเจกต์แบ่งเป็น 2 ส่วนที่ต้องรันพร้อมกัน: **Backend (Server)** และ **Frontend (Client)**

### 1️⃣ รัน Backend (Server)

Backend คือ Node.js HTTP server ที่จัดการ game state และ WebSocket สำหรับ multiplayer

```bash
npm run start
```

- Server จะรันที่ **`http://localhost:4174`**
- รองรับ REST API ที่ path `/api/...`
- รองรับ WebSocket สำหรับการเล่นแบบ real-time

### 2️⃣ รัน Frontend (Client)

Frontend คือ Vite dev server ที่ serve หน้าเว็บและ proxy request ไปหา backend

```bash
npm run dev
```

- เปิดเบราว์เซอร์ไปที่ **`http://localhost:5173`**
- Vite จะ proxy `/api` requests ไปยัง backend ที่ port 4174 โดยอัตโนมัติ
- รองรับ Hot Module Replacement (HMR)

### ✅ สรุปขั้นตอน

```bash
# Terminal 1 — Backend
npm run start

# Terminal 2 — Frontend
npm run dev
```

จากนั้นเปิด **http://localhost:5173** ในเบราว์เซอร์

---

## 🧪 คำสั่งเพิ่มเติม

```bash
# รัน Tests
npm test

# ตรวจสอบ TypeScript types (ไม่ compile)
npm run typecheck

# Lint โค้ด
npm run lint

# แก้ปัญหา Lint อัตโนมัติ
npm run lint:fix

# Format โค้ดด้วย Prettier
npm run format

# ตรวจสอบว่า format ถูกต้องหรือไม่
npm run format:check

# Build สำหรับ Production
npm run build
```

---

## 📁 โครงสร้างโปรเจกต์

```
WuWa-Thai-Duel/
├── src/
│   ├── client/          # Frontend TypeScript (UI, animations, game client)
│   │   ├── client.ts    # Entry point ฝั่ง client
│   │   ├── style.css    # Tailwind CSS styles
│   │   └── ...
│   ├── server/          # Backend TypeScript (game logic, HTTP/WS server)
│   │   └── server.ts    # Entry point ฝั่ง server
│   ├── engine/          # Game engine (rules, bot AI)
│   │   └── bot.ts
│   └── types/           # TypeScript type definitions ที่ใช้ร่วมกัน
│       └── game.ts
├── public/              # Static assets
├── data/                # Card data และ game data
├── tests/               # Test files
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies และ scripts
└── README.md            # ไฟล์นี้
```

---

## 🔄 Migration: JavaScript → TypeScript

Branch นี้ (`newToolingandStandards`) เปลี่ยนมาใช้ **TypeScript** ทั้งโปรเจกต์

### สิ่งที่เปลี่ยนแปลง

- ไฟล์ `.js` ทั้งหมดในฝั่ง client และ server ถูกแปลงเป็น `.ts`
- เปิดใช้งาน **strict mode** ใน `tsconfig.json`
- เพิ่ม type definitions ที่ `src/types/game.ts` สำหรับใช้ร่วมกันระหว่าง client และ server
- ใช้ `tsx` เป็น runtime สำหรับรัน TypeScript บน Node.js โดยตรง (ไม่ต้อง compile ก่อน)
- ใช้ `typescript-eslint` สำหรับ linting TypeScript

### ประโยชน์ที่ได้รับ

- ตรวจจับ bugs ได้ตั้งแต่ขั้นตอน development (compile-time errors)
- IntelliSense และ autocomplete ที่ดีขึ้นใน IDE
- Code ที่อ่านง่ายและ maintain ได้ง่ายขึ้นจาก type annotations
- Refactoring ปลอดภัยขึ้นด้วย type checking

---

## 📄 เอกสารเพิ่มเติม

- [README-TH.md](./README-TH.md) — รายละเอียดโปรเจกต์ฉบับภาษาไทย
- [RULES-TH.md](./RULES-TH.md) — กฎการเล่นฉบับเต็ม
- [CARD-BACK-ASSETS.md](./CARD-BACK-ASSETS.md) — ข้อมูล assets การ์ด
