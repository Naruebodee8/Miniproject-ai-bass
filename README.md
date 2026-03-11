# 🏀Mr.ZebraBKB

ระบบถาม-ตอบกฎบาสเกตบอล FIBA อย่างเป็นทางการ โดย AI พร้อมอ้างอิงข้อกฎทุกครั้ง

## Tech Stack

- **Frontend**: Next.js 15 + Tailwind CSS
- **AI**: Google Gemini 2.5 Flash-Lite
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts

## Features

- 💬 แชทถาม-ตอบกฎบาสเกตบอลภาษาไทย
- 📖 อ้างอิงข้อกฎ (Art 25, Art 33 ฯลฯ) ทุกครั้ง
- 👍👎 HITL Feedback (Human-in-the-loop)
- ⚠️ Guardrail แจ้งเตือนเมื่อ AI ไม่มั่นใจ
- 🗂️ ประวัติการสนทนา (Session History)
- 📊 Dashboard KPI (latency, accuracy)

## Getting Started

### 1. Clone repo

```bash
git clone https://github.com/Naruebodee8/Miniproject-ai-bass
```
### 2. ติดตั้ง dependencies

```bash
npm install
```

### 3. ตั้งค่า Environment Variables

```bash
cp .env.example .env.local
# แก้ไขค่าใน .env.local ด้วย key ของคุณ
```

### 4. สร้างตาราง Supabase

รัน SQL นี้ใน Supabase Dashboard → SQL Editor:

```sql
CREATE TABLE qa_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_ref TEXT,
  confidence_score FLOAT,
  latency_ms INTEGER,
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. รัน Dev Server

```bash
npm run dev
```
หรือเข้าชมงานได้ที่นี่: https://miniproject-ai-bass-831o.vercel.app/
## หน้าต่างๆ

| URL | หน้า |
|---|---|
| `/` | Chat UI |
| `/dashboard` | KPI Dashboard |

สรุปผล
ผลการดำเนินงาน: แชทบอท ตอบแชทได้อย่างเข้าใจง่าย และถูกต้องตามกฎที่เทรนไว้ 
ปัญหาและอุปสรรค: ตัวแชทบอท เมื่อถามคำถามไปแล้ว มันขึ้นนำError เมื่อนำError ไปถามใหม่มันจะทำการจำค่าก่อนหน้านี้มาตอบเป็นกฎใหม่ แบบมั่ว
ข้อเสนอแนะสำหรับการพัฒนาต่อยอด: ตั้งค่าให้มันไม่ต้องไปสนใจแชทถามตอบก่อนหน้านี้น้อยลง
ข้อมูลอ้างอิงมาจาก: กฎจาก FIBA ที่นำไปเทรนโมเดลมาแล้ว 


