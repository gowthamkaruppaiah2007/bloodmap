import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  requestNotificationPermissionAndGetToken,
  setupForegroundMessageListener,
} from "@/lib/firebase";

export function useNotifications() {
  useEffect(() => {
    let mounted = true;

    async function initNotifications() {
      const { data } = await supabase.auth.getUser();
      if (data?.user && mounted) {
        await requestNotificationPermissionAndGetToken(data.user.id);
        await setupForegroundMessageListener();
      }
    }

    initNotifications();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user && mounted) {
        await requestNotificationPermissionAndGetToken(session.user.id);
        await setupForegroundMessageListener();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
}
