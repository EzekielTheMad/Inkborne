import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type RunnerSettings } from "./settings";
export async function verifyExistingAccounts(settings: RunnerSettings) {
    const makeClient = (key: string) => createClient(settings.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const primary = makeClient(settings.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const secondary = makeClient(settings.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const admin = makeClient(settings.SUPABASE_SERVICE_ROLE_KEY);
    const clients = [primary, secondary];
    try {
        const health = await fetch(`${settings.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: settings.NEXT_PUBLIC_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(15000) });
        if (!health.ok)
            throw new Error(`Auth health failed (${health.status})`);
        const ids: string[] = [];
        for (const [index, role] of ["TEST", "PLAYER"].entries()) {
            const { data, error } = await clients[index].auth.signInWithPassword({ email: settings[`E2E_${role}_EMAIL` as keyof RunnerSettings], password: settings[`E2E_${role}_PASSWORD` as keyof RunnerSettings] });
            if (error || !data.user)
                throw new Error(`Existing ${index === 0 ? "primary" : "secondary"} account sign-in failed`);
            ids.push(data.user.id);
        }
        if (ids[0] === ids[1])
            throw new Error("Existing accounts resolve to the same user");
        const { error } = await admin.from("characters").select("id").limit(0);
        if (error)
            throw new Error("Trusted exact-ID cleanup client could not read character contract");
        return { primary, secondary, admin, ownerId: ids[0], secondaryId: ids[1], close: () => closeAccounts(clients) };
    }
    catch (error) {
        await closeAccounts(clients);
        throw error;
    }
}
async function closeAccounts(clients: SupabaseClient[]) {
    const results = await Promise.allSettled(clients.map(async (client) => {
        if (await client.auth.getSession().then(({ data }) => Boolean(data.session))) {
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error)
                throw new Error("Task account session cleanup failed");
        }
    }));
    if (results.some(result => result.status === "rejected"))
        throw new Error("Task account session cleanup failed");
}
