# pixelwar — 1024x1024

Canvas collectif 1024x1024. Chacun pose des pixels, stock de 10, 1 rendu toutes les 3 secondes.

## Ca tourne comment

Le code est sur GitHub, le site + l'api tournent sur Vercel. GitHub tout seul ne peut pas faire tourner l'api (pages statiques uniquement).

```
repo GitHub ──push──> Vercel (front + /api) ──> Redis Upstash (canvas + stocks)
```

## Lancer en local

Terminal 1 :
```
npm install
npm run dev:api
```

Terminal 2 :
```
npm run dev
```

Ouvrir http://localhost:5173.

## Mettre en ligne

Un seul repo suffit (front + api ensemble). C'est le plus simple avec Vercel.

```
cd pixel-war
git init
git add .
git commit -m "pixelwar"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/pixelwar.git
git push -u origin main
```

Puis sur vercel.com : New Project > Import > Deploy.

Ensuite : onglet Storage > Create > Upstash Redis (offre gratuite) > Connect > Redeploy.
Vérif : `https://TON_PROJET.vercel.app/api/health` doit répondre `store:"redis"`.

## Si tu veux vraiment 2 repos séparés

Possible mais plus pénible : il faut 2 projets Vercel (un pour le front, un pour l'api), régler le CORS et mettre l'url de l'api dans le front. Pas recommandé pour commencer. Reste sur 1 repo.

## Endpoints

- `GET /api/canvas` : tout le canvas (base64, ~1.4Mo, une seule fois)
- `GET /api/diff?since=` : ce qui a changé depuis (toutes les 2 sec)
- `POST /api/pixels` : `{ clientId, pixels: [{x,y,color}] }`
- `GET /api/stock?clientId=` : stock restant
- `GET /api/health`

## Import d'image

Bouton "importer une image" : choisis un fichier (png/jpg/webp), règle la
largeur/hauteur (max 256x256, proportions verrouillées ou non), place le
coin via x/y ou en cliquant sur le canvas. L'image est convertie vers la
palette 16 couleurs (le transparent est ignoré), un fantôme s'affiche sur
le canvas, et la construction pose les pixels toute seule au rythme du
stock (pauses/reprise/déplacement possibles, survit au reload).

## Régler le stock

Voir `api/_lib/config.js` : `MAX_STOCK = 10`, `REFILL_INTERVAL_MS = 3000`.
