const pathlyCloud = (() => {
  const { url, publishableKey } = window.pathlySupabaseConfig;
  const configured = Boolean(url?.trim() && publishableKey?.trim());
  const canConnect = configured && ['http:', 'https:'].includes(location.protocol);
  let client;

  async function connect(onSession) {
    if (!publishableKey.trim().startsWith('sb_publishable_') || new URL(url).protocol !== 'https:') {
      throw new Error('Enter a Supabase HTTPS URL and publishable key in supabase-config.js.');
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('The Supabase library took too long to load.'));
      }, 12000);
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('The Supabase library could not load. Check your internet connection.'));
      };
      document.head.append(script);
    });

    client = window.supabase.createClient(url.trim(), publishableKey.trim());
    client.auth.onAuthStateChange((event, session) => {
      // Database calls run outside Supabase's auth callback.
      setTimeout(() => onSession(session?.user ?? null), 0);
    });
  }

  async function signIn(mode, email, password) {
    if (mode === 'signup') {
      const emailRedirectTo = new URL(location.pathname, location.origin).href;
      return client.auth.signUp({ email, password, options: { emailRedirectTo } });
    }
    return client.auth.signInWithPassword({ email, password });
  }

  const table = () => client.from('pathly_saved_activities');

  function load(userId) {
    return table().select('activity_id,kind,status').eq('user_id', userId);
  }

  function change(userId, activityId, kind, value) {
    if (value === null) {
      return table().delete().eq('user_id', userId).eq('activity_id', activityId).eq('kind', kind);
    }
    return table().upsert({
      user_id: userId,
      activity_id: activityId,
      kind,
      status: kind === 'plan' ? value : null
    }, { onConflict: 'user_id,activity_id,kind' });
  }

  function importActivities(userId, saved, plan) {
    const bookmarks = saved.map(activityId => ({
      user_id: userId, activity_id: activityId, kind: 'bookmark', status: null
    }));
    const tracked = Object.entries(plan).map(([activityId, status]) => ({
      user_id: userId, activity_id: activityId, kind: 'plan', status
    }));
    return table().upsert([...bookmarks, ...tracked], {
      onConflict: 'user_id,activity_id,kind', ignoreDuplicates: true
    });
  }

  return { configured, canConnect, connect, signIn, load, change, importActivities,
    signOut: () => client.auth.signOut({ scope: 'local' }) };
})();
