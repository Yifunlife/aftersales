import {redirect} from 'next/navigation';
import {legacyCustomerTarget} from '../../lib/customer.mjs';
export default async function CustomerPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 redirect(legacyCustomerTarget(await searchParams));
}
