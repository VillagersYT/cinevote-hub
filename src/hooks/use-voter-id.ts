import { useEffect, useState } from "react";

const KEY = "cine_voter_id";

function generate() {
  return "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useVoterId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = generate();
      localStorage.setItem(KEY, v);
    }
    setId(v);
  }, []);
  return id;
}
