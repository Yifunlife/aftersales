import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleAccounts } from '../../../lib/accounts.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){return handleAccounts(request,{db:env.DB,ownerEmail:(env as any).AUTH_OWNER_EMAIL,identity:await getChatGPTUser()});}
export const GET=handle;export const POST=handle;
