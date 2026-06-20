/**
 * Cookie name for a cleared demo password gate. Plain module (NOT "use server")
 * so both the server action and the page can import this sync helper — a
 * "use server" file may only export async functions.
 */
export const gateCookie = (token: string) => `pv_${token}`;
