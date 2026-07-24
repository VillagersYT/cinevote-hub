# Déploiement Vercel + Supabase (frontend statique)

Ce projet est configuré pour que Vercel héberge uniquement le frontend statique. Toute la donnée passe directement par Supabase avec les règles RLS de la base.

## Étapes (une seule fois)

### 1. Importer le repo sur Vercel
- Vercel > **Add New… > Project** > sélectionner ce repo GitHub.
- Framework Preset : **Other** (Vercel détecte Vite/TanStack Start automatiquement grâce à `NITRO_PRESET=vercel` défini dans `vercel.json`).
- Cliquer **Deploy** (le premier build échouera tant que Supabase n'est pas branché — c'est normal).

### 2. Brancher Supabase via l'intégration officielle Vercel
- Sur le projet Vercel > **Storage** (ou **Integrations**) > **Marketplace** > chercher **Supabase** > **Add Integration**.
- Choisir le projet Supabase (existant ou nouveau) et lier au projet Vercel.
- L'intégration crée automatiquement ces variables d'env dans Vercel selon sa version :
  - `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `POSTGRES_URL` (non utilisé ici)

Le script `build:vercel` transforme automatiquement ces noms en variables `VITE_*` utilisables par le frontend. Aucune variable backend n'est nécessaire au runtime Vercel.

### 3. Ajouter le token TMDB
Une seule variable à définir à la main :
- Vercel > Project > **Settings > Environment Variables** > Add :
  - Name : `TMDB_READ_TOKEN`
  - Value : *(votre token de lecture TMDB)*
  - Environments : Production, Preview, Development

Comme Vercel n'héberge plus de backend pour ce projet, la recherche TMDB se fait côté navigateur : ce token est donc exposé dans le bundle frontend.

### 4. Redéployer
Vercel > Deployments > dernier déploiement > **Redeploy**.

### 5. Appliquer les migrations Supabase
Une fois la DB Supabase créée, appliquer les migrations SQL présentes dans `supabase/migrations/` :
- Supabase Dashboard > SQL Editor > coller le contenu de chaque migration dans l'ordre.
- Ou via CLI : `supabase link --project-ref <ref>` puis `supabase db push`.

### 6. Se donner le rôle admin
Dans Supabase > SQL Editor :
```sql
insert into public.user_roles (user_id, role)
values ('<votre-user-id>', 'admin');
```
(Créez d'abord un compte via `/auth` sur le site déployé.)

## C'est tout
- Push sur `main` → déploiement auto.
- Vercel sert `dist/client` uniquement, sans fonction serveur.
- Supabase se re-configure tout seul si vous rebranchez l'intégration.
