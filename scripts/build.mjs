import {rm,mkdir,cp,copyFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const file of ['public/app.js','api/index.js'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const names={
'aerial.jpg':'villa-aerial.jpg',
'veranda.jpg':'villa-veranda.jpg',
'garden-wide.jpg':'villa-garden-wide.jpg',
'garden-terrace.jpg':'villa-garden-terrace.jpg',
'garden-loungers.jpg':'villa-garden-loungers.jpg',
'bedroom.jpg':'villa-bedroom.jpg'
};
await rm('dist',{recursive:true,force:true});
await cp('public','dist',{recursive:true});
await mkdir('dist/images',{recursive:true});
for(const [to,from] of Object.entries(names)){
 await access('public/resources/'+from);
 await copyFile('public/resources/'+from,'dist/images/'+to);
}
console.log('Troian 2027: static frontend, six villa photographs and independent Vercel API prepared.');
