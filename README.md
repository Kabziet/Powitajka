# Prosty bot muzyczny na Discorda (Railway + GitHub)

Bot obsługuje trzy komendy:

- `/graj <url>` – odtwarza muzykę z linku (YouTube, SoundCloud i inne serwisy obsługiwane przez bibliotekę `play-dl`)
- `/graj-plik <plik>` – odtwarza wgrany plik muzyczny
- `/stop` – zatrzymuje odtwarzanie i wylogowuje bota z kanału głosowego

## Wymagania

- Node.js 18+
- Konto Discord + utworzona aplikacja / bot
- Konto na [Railway](https://railway.app/) / railway.gg
- Repozytorium na GitHubie

## Konfiguracja bota na Discordzie (panel developerski)

1. Wejdź na stronę [Discord Developer Portal](https://discord.com/developers/applications).
2. Utwórz nową aplikację (New Application).
3. W zakładce **Bot**:
   - Utwórz bota (Add Bot).
   - Skopiuj **token bota** i zapisz go – będzie potrzebny jako `DISCORD_TOKEN`.
   - Włącz **PRESENCE INTENT**, **SERVER MEMBERS INTENT** w razie potrzeby (nie jest wymagane do tego prostego bota, ale nie zaszkodzi).
4. W zakładce **OAuth2 → General** skopiuj **Application ID** – będzie potrzebny jako `CLIENT_ID`.
5. W zakładce **OAuth2 → URL Generator**:
   - Zaznacz `bot` i `applications.commands`.
   - W sekcji **Bot Permissions** wybierz:
     - `Connect`
     - `Speak`
     - `Use Slash Commands` (lub `Use Application Commands`)
   - Skopiuj wygenerowany link, wejdź w niego i dodaj bota na swój serwer.

## Zmienne środowiskowe

Skopiuj plik `.env.example` do `.env`:

```bash
cp .env.example .env
```

Uzupełnij wartości:

```env
DISCORD_TOKEN=twoj_token_bota
CLIENT_ID=id_aplikacji_discord
GUILD_ID=id_twojego_serwera
```

`GUILD_ID` to ID serwera, na którym chcesz testować bota (pobierzesz je po włączeniu trybu deweloperskiego w Discordzie i kliknięciu PPM na serwer).

Jeśli zostawisz `GUILD_ID` puste, komendy zostaną zarejestrowane globalnie, ale może to potrwać do godziny.

## Uruchomienie lokalne (testy)

1. Zainstaluj zależności:

   ```bash
   npm install
   ```

2. Zarejestruj komendy slash:

   ```bash
   npm run deploy-commands
   ```

3. Uruchom bota:

   ```bash
   npm start
   ```

4. Na swoim serwerze wpisz:

   - `/graj url: <link>` – np. link do YouTube
   - `/graj-plik plik: <plik>` – wgraj MP3 / OGG / WEBM / WAV / FLAC / M4A
   - `/stop`

## Deployment na Railway (przez GitHub)

1. Utwórz repozytorium na GitHubie i wrzuć cały projekt (plik `package.json`, `index.js`, `deploy-commands.js`, `.env.example`, itd.).
2. Na stronie Railway:
   - Utwórz nowy projekt.
   - Wybierz opcję **Deploy from GitHub repo** i wskaż swoje repo.
3. Railway automatycznie wykryje projekt Node.js (na podstawie `package.json`) i uruchomi komendę:

   ```bash
   npm start
   ```

4. W panelu Railway ustaw zmienne środowiskowe:

   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`

   (nie wrzucaj pliku `.env` do repozytorium!).

5. Po każdej zmianie w repozytorium Railway zbuduje i zdeployuje nową wersję bota.

## Jak to działa technicznie

- `index.js`:
  - Łączy się z Discordem przy użyciu `discord.js`.
  - Obsługuje komendy slash:
    - `/graj` – sprawdza, czy użytkownik jest na kanale głosowym, dołącza do kanału, pobiera strumień audio z linku przy pomocy `play-dl` i odtwarza go przez `@discordjs/voice`.
    - `/graj-plik` – pobiera wgrany plik (attachment), streamuje go z serwerów Discord i odtwarza jako audio.
    - `/stop` – zatrzymuje odtwarzanie i niszczy połączenie z kanałem głosowym.
  - Dla każdego serwera utrzymuje osobny odtwarzacz audio.
- `deploy-commands.js`:
  - Rejestruje komendy slash (`/graj`, `/graj-plik`, `/stop`) dla konkretnego serwera (`GUILD_ID`) lub globalnie.

## Ograniczenia / uwagi

- Bot używa biblioteki `play-dl`, która obsługuje m.in. YouTube i SoundCloud. Inne serwisy działają w takim zakresie, w jakim wspiera je `play-dl`.
- Nie ma kolejki utworów – każde wywołanie `/graj` zastępuje poprzednie odtwarzanie.
- Bot nie zapisuje plików na dysku – strumieniuje je bezpośrednio.

Jeśli chcesz później rozbudować projekt (kolejka, skip, pauza, resume, playlisty), można dołożyć dodatkowe komendy i prosty system kolejkowania.
