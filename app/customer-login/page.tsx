'use client';
import CustomerAccess from '../customer-access';
export default function Login(){return <CustomerAccess onReady={()=>{location.href='/request'}}/>}
