import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function useRequireAuth() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) navigate({ to: "/signin" });
      else setChecking(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) navigate({ to: "/signin" });
      else setChecking(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  return checking;
}
