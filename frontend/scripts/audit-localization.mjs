import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const load = (file,key) => {
  const source=fs.readFileSync(file,'utf8').replace(`export const ${key}`,`const ${key}`);
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return new Function('exports',js+`;return ${key};`)({});
};
const messages=load('src/lib/ui-messages.ts','UI_MESSAGES');
const old=load('src/lib/translations.ts','TRANSLATIONS');
const normalize=s=>s.replace(/\s+/g,' ').trim().toLowerCase();
const available=new Set([...Object.keys(messages),...Object.values(old).map(e=>e.en)].map(normalize));
const found=new Set();
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.tsx')?[path.join(dir,e.name)]:[]);
for(const file of files('src')){
 const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='tx'&&ts.isStringLiteral(node.arguments[0]))found.add(node.arguments[0].text);ts.forEachChild(node,visit);}visit(tree);
}
const missing=[...found].filter(s=>!available.has(normalize(s))&&!/^[\d\W]+$|^EN$|^S$|^(Sarvam|SAM-)/.test(s));
console.log('UI strings',found.size,'missing',missing.length);
console.log(JSON.stringify(missing,null,2));
if(missing.length)process.exitCode=1;
