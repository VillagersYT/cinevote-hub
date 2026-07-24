const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("");
  console.error("Variables d'environnement manquantes :");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  console.error("");
  console.error("Ajoute-les dans Vercel > Settings > Environment Variables, puis redéploie.");
  console.error("");
  process.exit(1);
}
