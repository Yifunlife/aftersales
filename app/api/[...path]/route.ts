import {handleNotifications} from '../../../lib/work-notifications.mjs';
import {handleProblemAnalysis} from '../../../lib/problem-analysis.mjs';
import {handleKnowledgeIntake} from '../../../lib/knowledge-intake.mjs';
import {handleAssistant} from '../../../lib/assistant.mjs';
import {handleUnifiedLogin} from '../../../lib/unified-auth.mjs';
import {handleCustomerAuth} from '../../../lib/customer-auth.mjs';
import {handleKnowledge} from '../../../lib/knowledge.mjs';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import {handleCustomerIntake} from '../../../lib/customer-intake.mjs';
import { handleAccounts } from '../../../lib/accounts.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){const path=new URL(request.url).pathname;if(path.startsWith('/api/notifications'))return handleNotifications(request,{db:env.DB,config:(env as any).WECOM,jobSecret:(env as any).NOTIFICATION_JOB_SECRET});if(path.startsWith('/api/problem-analysis'))return handleProblemAnalysis(request,{db:env.DB});if(path.startsWith('/api/knowledge-intake'))return handleKnowledgeIntake(request,{db:env.DB,bucket:(env as any).BUCKET,ai:(env as any).AI});if(path==='/api/assistant')return handleAssistant(request,{db:env.DB,bucket:(env as any).BUCKET,ai:(env as any).AI});if(path==='/api/auth/unified-login')return handleUnifiedLogin(request,{db:env.DB});if(path.startsWith('/api/knowledge'))return handleKnowledge(request,{db:env.DB,bucket:(env as any).BUCKET});if(path.startsWith('/api/customer-auth/')||path==='/api/customer-accounts')return handleCustomerAuth(request,{db:env.DB});if(new URL(request.url).pathname.startsWith('/api/customer/'))return handleCustomerIntake(request,{db:env.DB,bucket:(env as any).BUCKET});return handleAccounts(request,{db:env.DB,ownerEmail:(env as any).AUTH_OWNER_EMAIL,identity:process.env.DEPLOY_TARGET==='node'?null:await getChatGPTUser(),initialAdmin:{hash:(env as any).INITIAL_ADMIN_HASH,salt:(env as any).INITIAL_ADMIN_SALT}});}
export const GET=handle;export const POST=handle;
