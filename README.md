# SocialEye – Apri Link Social

Web app di una sola pagina: incolli un link ricevuto da un social (Instagram, TikTok, Facebook, X, YouTube, Reddit, Threads, Pinterest, Vimeo, Bluesky, Telegram, Spotify, LinkedIn, Twitch) e, se il contenuto è pubblico, lo vedi senza avere un account.

- Usa solo i sistemi ufficiali di incorporamento (embed) dei social: niente scraping, niente aggiramento di login o account privati.
- Quando un contenuto non è visibile senza account (storie Instagram, profili X, gruppi Facebook, account privati…) l'app lo spiega.
- Si può aprire direttamente con un link: `https://<indirizzo-app>/?url=<link-del-post>`.
- La cronologia resta solo nel browser di chi la usa.

## Link abbreviati (facebook.com/share/…, vm.tiktok.com, t.co, pin.it)

Le app dei social condividono link abbreviati che i sistemi di incorporamento non leggono. La funzione `api/resolve.js` segue i redirect di questi link (solo per un elenco fisso di domini, senza cookie e senza login) e restituisce l'indirizzo completo del contenuto pubblico.

Serve un hosting con funzioni serverless: il progetto è pronto per **Vercel** (piano gratuito). Su vercel.com → *Add New → Project* → importa questo repository → *Deploy*, senza cambiare impostazioni. Su GitHub Pages l'app funziona lo stesso, ma senza espansione dei link abbreviati.

## Link condivisi di Facebook (/share/r/, /share/v/)

Facebook non rivela dove porta un link /share/ a chi non ha fatto l'accesso. Per questi link SocialEye usa l'API oEmbed ufficiale di Meta, che richiede un'app gratuita su developers.facebook.com con la funzione **oEmbed Read**. Nelle impostazioni del progetto Vercel (*Settings → Environment Variables*) aggiungi:

- `FB_APP_ID`: l'ID dell'app Meta
- `FB_CLIENT_TOKEN`: il token client (*Impostazioni app → Avanzate → Token client*)

Senza queste variabili il resto dell'app funziona, ma i link /share/ di Facebook non si aprono.
