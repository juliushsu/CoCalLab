import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url));
const ts=require('typescript');
export const parserVersion=ts.version;
export function importsOf(name,source){
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true),imports=[],unresolved=[];
 const add=(node,dynamic=false)=>{if(node&&ts.isStringLiteralLike(node))imports.push({specifier:node.text,dynamic});else unresolved.push({kind:'nonliteral_dynamic_import'});};
 const visit=node=>{if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){if(node.moduleSpecifier)add(node.moduleSpecifier);}else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)add(node.arguments[0],true);ts.forEachChild(node,visit);};
 visit(ast);
 for(const reference of ast.typeReferenceDirectives)imports.push({specifier:reference.fileName,dynamic:false,typeReference:true});
 return {imports,unresolved};
}
export function classify(specifier){
 if(specifier.startsWith('.'))return 'relative';
 if(specifier.startsWith('node:'))return 'node_builtin';
 if(/^npm:(?:@[^/]+\/)?[^@/]+@\d+[.]\d+[.]\d+(?:-[0-9A-Za-z.-]+)?(?:\/|$)/.test(specifier))return 'exact_npm';
 if(specifier.startsWith('npm:'))return 'floating_npm';
 if(/^https:\/\/esm[.]sh\/(?:@[^/]+\/)?[^@/?]+@\d+[.]\d+[.]\d+(?:-[0-9A-Za-z.-]+)?(?:[/?]|$)/.test(specifier))return 'exact_https';
 if(/^https:\/\//.test(specifier))return 'floating_or_unclassified_https';
 return 'other_external';
}
export function graphFor(entry,files){
 const visited=new Set(),edges=[],missing=[],unresolved=[];
 function walk(name){if(visited.has(name))return;visited.add(name);const value=files.get(name);if(!value){missing.push(name);return;}
  const parsed=importsOf(name,value);for(const item of parsed.unresolved)unresolved.push({file:name,...item});
  for(const item of parsed.imports){const kind=classify(item.specifier),target=kind==='relative'?path.posix.normalize(path.posix.join(path.posix.dirname(name),item.specifier)):item.specifier;edges.push({from:name,...item,kind,to:target});if(kind==='relative'){if(target.startsWith('../'))missing.push('OUTSIDE_SOURCE_ROOT:'+target);else walk(target);}}
 }
 walk(entry);return {entry,files:[...visited].sort(),edges,missing,unresolved,outsideFunctions:[...visited].filter(name=>!name.startsWith('backend/supabase/functions/')).sort()};
}
export function assertAnalysisCommand(args){
 if(!['--version','info','cache','check','bundle'].includes(args[0])||args.some(arg=>/^--(?:allow-(?:all|env|run|net|read|write|ffi|scripts)|preload|require|env-file|inspect(?:-brk|-wait)?)(?:=|$)/.test(arg)))throw new Error('Only non-executing Deno version/info/cache/check/bundle analysis is permitted');
}
