// Read JSON explicitly so Safari does not expose an opaque native SyntaxError
// when a hosting proxy returns HTML or an interrupted response.
export function apiURL(path,php=false){
  const split=path.indexOf('?'),action=split<0?path:path.slice(0,split),query=split<0?'':path.slice(split+1);
  if(!/^[a-z]+$/.test(action))throw Error('Ruta de datos no válida.');
  return php?`/api.php?a=${action}${query?'&'+query:''}`:`/api/${path}`;
}
export async function requestJSON(path,options={}, {php=false,fetcher=globalThis.fetch}={}){
  const url=apiURL(path,php),readOnly=!options.method||options.method.toUpperCase()==='GET';
  for(let attempt=0;attempt<(readOnly?2:1);attempt++){
    let response,text,value;
    try{
      response=await fetcher(url,{...options,cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json',...options.headers}});
      text=(await response.text()).replace(/^\uFEFF/,'');
      value=JSON.parse(text);
      if(!value||typeof value!=='object')throw Error('INVALID_JSON');
    }catch(error){
      if(error.name==='AbortError'||options.signal?.aborted)throw error;
      if(readOnly&&attempt===0)continue;
      throw Error('No se pudieron cargar los datos. Comprueba tu conexión y pulsa Actualizar agenda.');
    }
    if(!response.ok){const error=Error(typeof value.error==='string'?value.error:'El servidor no está disponible. Intenta de nuevo.');error.status=response.status;if(typeof value.code==='string')error.code=value.code;throw error;}
    return value;
  }
}
