export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Projection interrompue — Ciné-Club</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        padding: 1.5rem;
        display: grid;
        place-items: center;
        color: #f8fafc;
        background:
          radial-gradient(circle at 20% 15%, rgba(249, 115, 22, .22), transparent 35rem),
          radial-gradient(circle at 80% 85%, rgba(251, 191, 36, .14), transparent 30rem),
          #111827;
      }
      .card {
        width: min(100%, 34rem);
        padding: clamp(2rem, 7vw, 3.5rem);
        text-align: center;
        border: 1px solid rgba(255, 255, 255, .12);
        border-radius: 1.75rem;
        background: rgba(31, 41, 55, .82);
        box-shadow: 0 25px 70px rgba(0, 0, 0, .35);
        backdrop-filter: blur(18px);
      }
      .icon { font-size: 4.5rem; line-height: 1; }
      h1 { margin: 1.25rem 0 .75rem; font-size: clamp(1.7rem, 6vw, 2.5rem); line-height: 1.1; }
      p { margin: 0 auto 1.75rem; max-width: 26rem; color: #cbd5e1; line-height: 1.65; }
      .actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: .7rem 1.1rem;
        border: 1px solid transparent;
        border-radius: .7rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
      }
      .primary { color: #111827; background: #f97316; }
      .primary:hover { background: #fb923c; }
      .secondary { color: #f8fafc; background: transparent; border-color: rgba(255, 255, 255, .2); }
      .secondary:hover { background: rgba(255, 255, 255, .08); }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="icon" aria-hidden="true">📽️</div>
      <h1>Projection interrompue</h1>
      <p>La page n’a pas pu être chargée. Réessaie dans un instant ou retourne à l’accueil du ciné-club.</p>
      <div class="actions">
        <button class="primary" type="button" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Retour à l’accueil</a>
      </div>
    </main>
  </body>
</html>`;
}
