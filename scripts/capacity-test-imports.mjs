import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='server-only') return {url:'data:text/javascript,export {};',shortCircuit:true};
  if(specifier==='next/server') return nextResolve('next/server.js',context);
  if(specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.includes('/src/'))) {
    const url=specifier.startsWith('@/') ? new URL(`../src/${specifier.slice(2)}`,import.meta.url) : new URL(specifier,context.parentURL);
    const filename=fileURLToPath(url);
    for(const candidate of [filename,`${filename}.ts`,`${filename}/index.ts`]) if(existsSync(candidate)) return {url:pathToFileURL(candidate).href,shortCircuit:true};
  }
  return nextResolve(specifier,context);
}});
