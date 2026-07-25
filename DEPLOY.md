# Déploiement sur Vercel

Le projet utilise TanStack Start avec des fonctions serveur Vercel. Les
identifiants publics Supabase restent disponibles dans le navigateur, tandis
que le token TMDB et la clé Supabase privilégiée restent uniquement côté
serveur.

## 1. Importer le dépôt

Dans Vercel, ouvrir **Add New… > Project**, sélectionner ce dépôt GitHub et
laisser Vercel utiliser la commande `npm run build:vercel`.

## 2. Ajouter les variables Vercel

Dans **Project > Settings > Environment Variables**, ajouter ces variables pour
Production, Preview et Development :

- `SUPABASE_URL` : URL du projet Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur Supabase `service_role` ou clé
  secrète équivalente. Ne jamais préfixer cette variable par `VITE_`.
- `TMDB_READ_TOKEN` : token de lecture TMDB. Ne jamais préfixer cette variable
  par `VITE_`.
- `VITE_ADMIN_EMAIL` : email d’un compte Supabase existant, utilisé pour la
  connexion rapide avec mot de passe uniquement.

La configuration publique du projet actuel possède des valeurs par défaut. Pour
utiliser un autre projet Supabase, définir également :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Le mot de passe administrateur n’est jamais une variable Vercel et n’est jamais
intégré au site : il est envoyé directement à Supabase lors de la connexion.

## 3. Appliquer les migrations Supabase

Dans **Supabase > SQL Editor**, exécuter tous les fichiers du dossier
`supabase/migrations/` dans l’ordre. Le dernier fichier à appliquer est :

`20260725152000_all_authenticated_users_are_admin.sql`

Cette migration :

- considère chaque compte Supabase authentifié comme administrateur ;
- retire aux visiteurs anonymes l’écriture directe dans les propositions et les
  votes ;
- oblige les visiteurs à passer par les fonctions serveur qui vérifient les
  limites, les dates du sondage et les catégories TMDB.

## 4. Verrouiller la création de comptes

Dans **Supabase > Authentication > Providers > Email**, désactiver les
inscriptions publiques. Tous les comptes existants peuvent administrer le site,
donc seuls les comptes créés volontairement dans Supabase doivent pouvoir se
connecter.

## 5. Redéployer

Dans **Vercel > Deployments**, redéployer le dernier commit après l’ajout des
variables. Un push sur `main` déclenchera ensuite les prochains déploiements.

## Contrôle rapide

- `/` charge les réglages et les séances.
- `/auth` accepte email + mot de passe ou le mot de passe seul si
  `VITE_ADMIN_EMAIL` est défini.
- `/admin` permet de gérer les séances, films, votes et réglages.
- La recherche TMDB ne doit pas faire apparaître le token dans les outils réseau
  du navigateur.
