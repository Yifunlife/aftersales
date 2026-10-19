import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import {handleCustomerIntake} from '../../../lib/customer-intake.mjs';
import { handleAccounts } from '../../../lib/accounts.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){if(new URL(request.url).pathname.startsWith('/api/customer/'))return handleCustomerIntake(request,{db:env.DB,bucket:(env as any).BUCKET});return handleAccounts(request,{db:env.DB,ownerEmail:(env as any).AUTH_OWNER_EMAIL,identity:await getChatGPTUser(),initialAdmin:{hash:(env as any).INITIAL_ADMIN_HASH,salt:(env as any).INITIAL_ADMIN_SALT}});}
export const GET=handle;export const POST=handle;
