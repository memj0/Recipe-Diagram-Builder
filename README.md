# Recipe Flowchart

A Vercel-ready Next.js application that converts pasted recipe text or a public recipe URL into a visual cooking flowchart.

## Main feature: deterministic parsing

The application processes recipes with its own non-AI parser first. It:

- extracts Schema.org `Recipe` JSON-LD from recipe pages
- detects ingredient and instruction sections
- recognises quantities, units and ingredient-shaped lines
- detects actions such as mix, fold, bake, simmer and chill
- maps ingredients to the cooking stages where they are used
- separates preparation notes and final cooking or serving steps
- calculates and displays a parser-confidence score

AI is only an optional fallback. It runs when the deterministic parser scores below 72%, the user enables the fallback, and an OpenAI API key has been configured.

## Technology

- Next.js 15 App Router
- React 19
- TypeScript
- Cheerio for recipe-page extraction
- Optional OpenAI Responses API fallback
- Vercel deployment support

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The application works without any API key. To enable the optional fallback, edit `.env.local`:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Never commit `.env.local` or an API key to GitHub.

## Upload to GitHub

### GitHub website method

1. Create a new empty repository on GitHub.
2. Do not add another README, `.gitignore`, or licence when creating it.
3. Extract this project ZIP.
4. Open the extracted project folder and upload all files and folders to the repository root.
5. Commit the files.

### Command-line method

```bash
git init
git add .
git commit -m "Initial recipe flowchart app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## Deploy to Vercel

1. In Vercel, select **Add New → Project**.
2. Import the GitHub repository.
3. Keep the detected framework as **Next.js**.
4. Deploy. No environment variable is required for deterministic mode.
5. To enable AI fallback, add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` under **Project Settings → Environment Variables**, then redeploy.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run build
npm start
```

## Notes

Some recipe sites block automated requests. Users can paste the recipe text directly when extraction is unavailable. URL extraction accepts public HTTP or HTTPS pages and rejects common private-network addresses.
