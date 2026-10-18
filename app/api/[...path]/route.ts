import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleAccounts } from '../../../lib/accounts.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){return handleAccounts(request,{db:env.DB,ownerEmail:(env as any).AUTH_OWNER_EMAIL,identity:await getChatGPTUser(),initialAdmin:{hash:(env as any).INITIAL_ADMIN_HASH,salt:(env as any).INITIAL_ADMIN_SALT}});}
export const GET=handle;export const POST=handle;
