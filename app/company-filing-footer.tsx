'use client';
import {useEffect,useState} from 'react';
export default function CompanyFilingFooter(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>setVisible(location.hostname==='aftersales.shyiwan.com'),[]);
 if(!visible)return null;
 return <footer style={{padding:'14px 16px',textAlign:'center',fontSize:12,color:'#64748b'}}><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" style={{color:'inherit'}}>沪ICP备20020331号-1</a></footer>;
}
