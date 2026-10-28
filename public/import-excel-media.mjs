const officeRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
const relId=(node,name='id')=>node.getAttributeNS(officeRel,name)||node.getAttribute('r:'+name);
function resolvePart(base,target){
 if(!target||/[?#\\]/.test(target)||/^[a-z]+:/i.test(target))throw Error('表格图片引用格式不支持，请重新插入照片后保存为 XLSX。');
 const parts=target.startsWith('/')?[]:base.split('/').slice(0,-1);
 for(const part of target.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw Error('表格图片路径无效。');parts.pop()}else parts.push(part)}
 return parts.join('/');
}
const relPart=part=>part.slice(0,part.lastIndexOf('/')+1)+'_rels/'+part.split('/').pop()+'.rels';
export function imageType(bytes){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export function issueRegions(rows,layout){
 const nonempty=row=>row?.some(c=>String(c??'').trim());
 if(String(rows[0]?.[0]||'').includes('售后维修记录单')){
  const starts=[];rows.forEach((row,i)=>{if(/^售后问题\s*\d+\s*$/.test(String(row[0]||'').trim()))starts.push(i)});
  return starts.flatMap((start,i)=>Object.values(layout.detail).some(([offset,col])=>String(rows[start+offset]?.[col]??'').trim())?[{start,end:Math.min(starts[i+1]??Infinity,start+Math.max(...Object.values(layout.detail).map(x=>x[0]))+1)}]:[]);
 }
 let header=true;return rows.flatMap((row,i)=>{if(!nonempty(row))return [];if(header){header=false;return []}return [{start:i,end:i+1}]});
}
// Read package-local images only. No external image URL is fetched or used as authority.
export function extractExcelPhotos(files,sheetName,rows,layout,Parser=globalThis.DOMParser){
 if(!files)return [];
 const index=new Map(Object.keys(files).map(p=>[p.toLowerCase(),p]));
 const entry=path=>files[index.get(path.toLowerCase())];
 function xml(path,optional=false){const f=entry(path);if(!f){if(optional)return null;throw Error('表格缺少图片关联资料：'+path)}
  if(f.content.length>5000000)throw Error('图片关联资料过大，请拆分表格。');
  const source=typeof f.content==='string'?f.content:new TextDecoder().decode(f.content);
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('不支持此表格的 XML 格式。');
  const doc=new Parser().parseFromString(source,'application/xml');if(!doc||nodes(doc,'parsererror').length)throw Error('表格图片关联资料损坏，请重新保存后导入。');return doc;
 }
 function relations(part){const doc=xml(relPart(part),true),out=new Map();if(doc)for(const n of nodes(doc,'Relationship'))out.set(n.getAttribute('Id'),{target:n.getAttribute('Target'),external:n.getAttribute('TargetMode')==='External',type:n.getAttribute('Type')});return out}
 function target(part,rels,id){const r=rels.get(id);if(!r||r.external)throw Error('发现外部或缺失的图片引用，请将图片实际插入表格后再导入。');return resolvePart(part,r.target)}
 const workbook=xml('xl/workbook.xml'),sheet=nodes(workbook,'sheet').find(s=>s.getAttribute('name')===sheetName);
 if(!sheet)throw Error('无法定位需要导入的工作表。');
 const part=target('xl/workbook.xml',relations('xl/workbook.xml'),relId(sheet)),sheetXml=xml(part),sheetRels=relations(part),regions=issueRegions(rows,layout),photos=[];
 let total=0;
 function add(path,row,end,origin){const file=entry(path);if(!file)throw Error('表格照片文件缺失，请重新插入照片。');const bytes=typeof file.content==='string'?Uint8Array.from(file.content,c=>c.charCodeAt(0)):new Uint8Array(file.content);
  const type=imageType(bytes);if(!type)throw Error('表格照片仅支持 JPG、PNG、WebP，请将其他图片转换后重新插入。');
  if(!bytes.length||bytes.length>10000000)throw Error('单张表格照片不能超过10MB，请压缩该照片后导入。');
  total+=bytes.length;if(total>100*1024*1024||photos.length>=500)throw Error('本次照片超过100MB或500张，请拆分表格。');
  const matches=regions.flatMap((region,i)=>Number.isInteger(row)&&row>=region.start&&row<region.end&&(end==null||end<=region.end)?[i]:[]);
  photos.push({id:origin,path,name:path.split('/').pop(),type,bytes,row,issue:matches.length===1?matches[0]:null});
 }
 for(const drawing of nodes(sheetXml,'drawing')){
  const drawingPart=target(part,sheetRels,relId(drawing)),doc=xml(drawingPart),rels=relations(drawingPart);
  for(const [i,anchor] of Array.from(doc.documentElement.childNodes).filter(n=>n.nodeType===1).entries()){
   const pics=nodes(anchor,'pic');if(!pics.length)continue;
   const from=nodes(anchor,'from')[0],to=nodes(anchor,'to')[0];
   const rowText=from&&nodes(from,'row')[0]?.textContent,row=/^\d+$/.test(rowText||'')?Number(rowText):null;
   const endText=to&&nodes(to,'row')[0]?.textContent,end=/^\d+$/.test(endText||'')?Number(endText)+(Number(nodes(to,'rowOff')[0]?.textContent||0)>0?1:0):null;
   for(const [j,pic] of pics.entries()){const blip=nodes(pic,'blip')[0];if(!blip)throw Error('发现暂不支持的图片格式，请重新插入为普通照片。');add(target(drawingPart,rels,relId(blip,'embed')),row,end,drawingPart+':'+i+':'+j)}
  }
 }
 // WPS DISPIMG cell pictures use named image records instead of drawing anchors.
 const formulas=nodes(sheetXml,'c').flatMap(c=>{const text=nodes(c,'f')[0]?.textContent||'';if(!/DISPIMG/i.test(text))return [];const match=text.match(/DISPIMG\s*\(\s*"([^"]+)"/i),row=Number((c.getAttribute('r')||'').match(/\d+$/)?.[0])-1;if(!match)throw Error('无法识别单元格图片，请重新插入照片。');return [{id:match[1],row}]});
 if(formulas.length){const cellPart=index.get('xl/cellimages.xml');if(!cellPart)throw Error('单元格图片没有实际保存在表格内，请重新保存原文件。');const doc=xml(cellPart),rels=relations(cellPart),images=new Map();
  for(const picture of nodes(doc,'cellImage')){const info=nodes(picture,'cNvPr')[0],blip=nodes(picture,'blip')[0];if(info&&blip)images.set(info.getAttribute('name'),target(cellPart,rels,relId(blip,'embed')))}
  for(const [i,f] of formulas.entries()){if(!images.has(f.id))throw Error('单元格照片关联缺失，请重新保存原文件。');add(images.get(f.id),f.row,f.row+1,'cell:'+i)}
 }
 if(nodes(sheetXml,'c').some(c=>c.hasAttribute('vm'))&&Array.from(index.keys()).some(k=>k.startsWith('xl/richdata/')))throw Error('此表含新版 Excel 单元格图片，请先转为“浮于单元格上方”的图片再导入。');
 return photos;
}
export function checkPhotoAssignments(photos,count){
 const counts=Array(count).fill(0);for(const p of photos){if(p.issue===-1)continue;if(!Number.isInteger(p.issue)||p.issue<0||p.issue>=count)throw Error('请先为每张照片选择对应问题，或明确选择“不导入此图”。');if(++counts[p.issue]>10)throw Error('每条售后问题最多10张照片，请拆分问题或取消多余照片。');}
 return counts;
}
