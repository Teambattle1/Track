# Forbedringer / TODO

## API Key Sikkerhed - Flyt fra client-side til server-side

**Status:** Planlagt
**Prioritet:** Medium

### Problem
Claude API-nøglen (`VITE_ANTHROPIC_API_KEY`) er pt. baked ind i client-side JS bundlen via Netlify environment variable. Det betyder at nøglen er synlig for alle der inspicerer koden i browseren (DevTools > Sources).

### Nuværende løsning
- `VITE_ANTHROPIC_API_KEY` sat som Netlify env var
- Vite embedder den i JS bundlen ved build-time
- `services/ai.ts` bruger den som fallback efter localStorage

### Forbedret løsning
Flyt alle AI API-kald til en **Netlify Edge Function** eller **Supabase Edge Function** så nøglen aldrig eksponeres til klienten:

1. **Opret server-side proxy** (Netlify Function eller Supabase Edge Function)
   - `/api/ai/generate-tasks` - task generation
   - `/api/ai/translate` - oversættelse
   - API-nøglen lever kun server-side som env var (uden `VITE_` prefix)

2. **Tilføj auth-check i proxy**
   - Verificer Supabase JWT token
   - Check at brugeren har admin/owner rolle
   - Kun autentificerede admins kan bruge AI-funktionerne

3. **Opdater `services/ai.ts`**
   - Kald proxy endpoint i stedet for Anthropic API direkte
   - Fjern `dangerouslyAllowBrowser: true`
   - Fjern `VITE_ANTHROPIC_API_KEY` fra Netlify env vars

### Fordele
- API-nøgle er aldrig synlig i browseren
- Kun admins kan bruge AI (server-side rolle-check)
- Kan tilføje rate limiting server-side
- Bedre kontrol over API-forbrug
