const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
  _user_id: data.user.id,
  _role: "admin",
});

if (roleError || !isAdmin) {
  console.error("[auth] admin role check failed:", roleError);
  await supabase.auth.signOut();
  throw new Error("Accès refusé.");
}
