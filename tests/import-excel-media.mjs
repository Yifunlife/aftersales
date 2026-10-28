import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {extractExcelPhotos,issueRegions,checkPhotoAssignments} from '../public/import-excel-media.mjs';
import fs from 'node:fs';import vm from 'node:vm';
const ns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=','base64'));
const xml=content=>({content}),rels=list=>xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+list.map(([Id,Target,extra=''])=>`<Relationship Id="${Id}" Target="${Target}" ${extra}/>`).join('')+'</Relationships>');
const layout={detail:{product:[1,2],owner:[2,6],issue:[3,2],installer:[8,2]}},rows=Array.from({length:28},()=>[]);
rows[0]=['亦玩集团售后维修记录单'];rows[9]=['售后问题 1'];rows[12][2]='问题一';rows[18]=['售后问题 2'];rows[21][2]='问题二';
const pic='<x:pic><a:blip r:embed="photo"/></x:pic>';
const anchor=(from,to)=>`<x:twoCellAnchor><x:from><x:row>${from}</x:row></x:from><x:to><x:row>${to}</x:row><x:rowOff>0</x:rowOff></x:to>${pic}</x:twoCellAnchor>`;
const files={
 'xl/workbook.xml':xml(`<workbook xmlns:r="${ns}"><sheets><sheet name="售后记录单" r:id="sheet"/><sheet name="填写示例" r:id="example"/></sheets></workbook>`),
 'xl/_rels/workbook.xml.rels':rels([['sheet','worksheets/sheet1.xml'],['example','worksheets/sheet2.xml']]),
 'xl/worksheets/sheet1.xml':xml(`<worksheet xmlns:r="${ns}"><drawing r:id="draw"/></worksheet>`),
 'xl/worksheets/_rels/sheet1.xml.rels':rels([['draw','../drawings/drawing1.xml']]),
 'xl/drawings/drawing1.xml':xml(`<x:wsDr xmlns:x="urn:draw" xmlns:a="urn:art" xmlns:r="${ns}">${anchor(14,15)+anchor(23,24)+anchor(17,20)+anchor(0,1)}</x:wsDr>`),
 'xl/drawings/_rels/drawing1.xml.rels':rels([['photo','../media/image1.png']]),
 'xl/media/image1.png':{content:png},
 'xl/media/unrelated-example.png':{content:png}
};
let photos=extractExcelPhotos(files,'售后记录单',rows,layout,DOMParser);
assert.deepEqual(photos.map(p=>p.issue),[0,1,null,null]);assert.equal(photos.length,4);assert.equal(photos[0].type,'image/png');assert.notEqual(photos[0].id,photos[1].id);
assert.throws(()=>checkPhotoAssignments(photos,2),/每张照片选择/);photos[2].issue=0;photos[3].issue=-1;assert.deepEqual(checkPhotoAssignments(photos,2),[2,1]);
assert.throws(()=>checkPhotoAssignments(Array.from({length:11},()=>({issue:0})),1),/最多10张/);
assert.deepEqual(issueRegions([['标题'],[],['a'],[],['b']],layout),[{start:2,end:3},{start:4,end:5}]);
const external={...files,'xl/drawings/_rels/drawing1.xml.rels':rels([['photo','https://evil.invalid/a.png','TargetMode="External"']])};assert.throws(()=>extractExcelPhotos(external,'售后记录单',rows,layout,DOMParser),/外部或缺失/);
assert.throws(()=>extractExcelPhotos({...files,'xl/media/image1.png':{content:new Uint8Array([1,2,3])}},'售后记录单',rows,layout,DOMParser),/仅支持/);
const cellFiles={...files,'xl/worksheets/sheet1.xml':xml('<worksheet><sheetData><row><c r="C14"><f>_xlfn.DISPIMG(&quot;IMG1&quot;,1)</f></c></row></sheetData></worksheet>'),
 'xl/cellimages.xml':xml(`<etc:cellImages xmlns:etc="urn:wps" xmlns:a="urn:art" xmlns:r="${ns}"><etc:cellImage><a:cNvPr name="IMG1"/><a:blip r:embed="cellphoto"/></etc:cellImage></etc:cellImages>`),
 'xl/_rels/cellimages.xml.rels':rels([['cellphoto','media/image1.png']])};
assert.deepEqual(extractExcelPhotos(cellFiles,'售后记录单',rows,layout,DOMParser).map(p=>p.issue),[0]);
assert.throws(()=>extractExcelPhotos({...cellFiles,'xl/cellimages.xml':xml('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///x">]><x/>')},'售后记录单',rows,layout,DOMParser),/XML/);
// A failed batch retains successful upload results. Retry sends only remaining photos and associates by issue.
const source=fs.readFileSync(new URL('../app-fragment.html',import.meta.url),'utf8'),code=source.slice(source.indexOf('async function uploadImportPhotos('),source.indexOf("$('#yw-import-photos').addEventListener"));
let calls=0,fail=true;const imageList=Array.from({length:12},(_,i)=>({issue:i<6?0:1,bytes:png,type:'image/png',name:'photo'+i+'.png'}));
const mockFetch=async(url,options)=>{
 calls++;if(calls===2&&fail)return {ok:false,json:async()=>({error:'网络中断'})};
 return {ok:true,json:async()=>({files:options.body.getAll('files').map((f,i)=>({id:calls+'-'+i,name:f.name,url:'/api/customer/file/'+calls+'-'+i}))})};
};
const context=vm.createContext({importTextConsent:false,importPhotos:imageList,importMedia:{checkPhotoAssignments},pending:[{id:'one'},{id:'two'}],$:()=>({textContent:''}),Blob,FormData,fetch:mockFetch});
vm.runInContext(code,context);await assert.rejects(()=>vm.runInContext('uploadImportPhotos()',context),/网络中断/);assert.equal(imageList.filter(p=>p.uploaded).length,5);fail=false;
const imported=await vm.runInContext('uploadImportPhotos()',context);assert.equal(calls,4);assert.equal(imported[0].attachments.length,6);assert.equal(imported[1].attachments.length,6);assert(imported.every(d=>d.attachments.every(f=>f.url.startsWith('/api/customer/file/'))));assert(!JSON.stringify(imported).includes('bytes'));
console.log('Excel photos: selected sheet only, issue anchors, ambiguous/manual/skip choices, WPS cells, private upload batching, retry and link-only records passed.');
