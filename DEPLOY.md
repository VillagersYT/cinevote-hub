# Déploiement Vercel (frontend statique)

Ce projet est configuré pour que Vercel héberge uniquement le frontend statique. Toute la donnée passe directement par la base avec les règles RLS.

## Étapes (une seule fois)

### 1. Importer le repo sur Vercel
- Vercel > **Add New… > Project** > sélectionner ce repo GitHub.
- Framework Preset : **Other**.
- Cliquer **Deploy**.

### 2. Configuration base de données
Le build Vercel contient déjà la configuration publique nécessaire pour se connecter à la base. Il n'y a donc plus besoin d'ajouter `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` ou `VITE_SUPABASE_PUBLISHABLE_KEY` dans Vercel.

Si vous préférez pointer vers une autre base, vous pouvez toujours définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans Vercel : elles remplaceront les valeurs par défaut.

### 3. Ajouter le token TMDB
Une seule variable reste à définir à la main :
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
- Aucune fonction serveur Vercel n'est nécessaire.
