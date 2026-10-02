import { supabase } from './supabase';

export const OWNER_ADMIN_EMAIL = 'nexwaveservices@gmail.com';

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
};
