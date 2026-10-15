// One atomic commit; IndexedDB is not limited to localStorage's small text quota.
export function createStorage(factory=globalThis.indexedDB){
 let connection;
 const open=()=>connection||=(new Promise((resolve,reject)=>{if(!factory){reject(Error('Armazenamento local indisponível.'));return;}const request=factory.open('zaporcamento',1);request.onupgradeneeded=()=>request.result.createObjectStore('dados');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};request.onblocked=()=>reject(Error('Feche outras janelas do app para continuar.'));}));
 return {
  async get(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('dados','readonly'),req=tx.objectStore('dados').get('estado');let value;req.onsuccess=()=>value=req.result;tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Leitura interrompida.'));});},
  async put(value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('dados','readwrite');tx.objectStore('dados').put(value,'estado');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Gravação interrompida.'));});}
 };
}
