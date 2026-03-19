# Creative Media 创媒

AI-Powered Media Creation Platform — From inspiration to publication, all in one platform.

Supports: English · 中文 · 한국어

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Deployment**: Vercel (Serverless)
- **Database**: Vercel Postgres + Prisma ORM
- **Storage**: Vercel Blob
- **Auth**: NextAuth.js + Google OAuth
- **Async Tasks**: Inngest (Serverless-native job orchestration)
- **AI APIs**: OpenAI Whisper (ASR), ElevenLabs (TTS), Azure Speech (CJK TTS)
- **Payments**: Stripe
- **i18n**: next-intl (EN/ZH/KO)

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd creative-media
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

**Required for Week 1:**
- `DATABASE_URL` / `DIRECT_URL` — Create at [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- `NEXTAUTH_SECRET` — Run `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- `BLOB_READ_WRITE_TOKEN` — Create at [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)

**Required for Week 2 (Engine B):**
- `OPENAI_API_KEY` — [OpenAI Platform](https://platform.openai.com/api-keys)
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — [Inngest Dashboard](https://app.inngest.com)

### 3. Initialize database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000

# In a separate terminal, run Inngest dev server:
npx inngest-cli@latest dev
```

### 5. Deploy to Vercel

```bash
# Link to Vercel project
npx vercel link

# Deploy
git add . && git commit -m "initial setup" && git push
# Vercel auto-deploys on push
```

## Project Structure

```
creative-media/
├── prisma/
│   └── schema.prisma          # Database schema (Users, Projects, Assets, Tasks)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/nextauth/  # NextAuth Google OAuth
│   │   │   ├── projects/       # Project CRUD
│   │   │   ├── assets/         # File upload to Vercel Blob
│   │   │   ├── transcribe/     # Engine B: Audio → Text
│   │   │   └── inngest/        # Inngest webhook endpoint
│   │   ├── dashboard/          # Main dashboard page
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/             # SessionProvider, Navbar, etc.
│   │   └── ui/                 # Reusable UI components
│   ├── lib/
│   │   ├── auth.ts             # NextAuth config
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── inngest.ts          # Inngest client
│   │   ├── inngest-functions.ts # Async task definitions
│   │   └── utils.ts            # Utility functions
│   ├── i18n/
│   │   └── config.ts           # next-intl configuration
│   ├── messages/               # i18n translations
│   │   ├── en/common.json
│   │   ├── zh/common.json
│   │   └── ko/common.json
│   └── types/
│       └── next-auth.d.ts      # TypeScript type extensions
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

## Development Roadmap

- [x] Week 1: Project scaffold + Auth + Database + File upload
- [ ] Week 2: Engine B core — Audio transcription (Whisper)
- [ ] Week 3: Engine B enhanced — Subtitles + Translation
- [ ] Week 4: Engine C core — Text-to-Speech
- [ ] Week 5: End-to-end pipeline + Asset library
- [ ] Week 6: PDF parsing + Onboarding UX
- [ ] Week 7: Stripe subscription + Quota management
- [ ] Week 8: Launch + Landing page

## License

Private — All rights reserved.
