import {rm,mkdir,cp,copyFile,access,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
for (const folder of ['api', 'public', 'server']) {
  for (const file of await readdir(folder)) {
    if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', folder + '/' + file], { stdio: 'inherit' });
  }
}
const names={
'aerial.jpg':'villa-aerial.jpg',
'veranda.jpg':'villa-veranda.jpg',
'garden-wide.jpg':'villa-garden-wide.jpg',
'garden-terrace.jpg':'villa-garden-terrace.jpg',
'garden-loungers.jpg':'villa-garden-loungers.jpg',
'bedroom.jpg':'villa-bedroom.jpg'
};
await rm('dist',{recursive:true,force:true});
await cp('public','dist',{recursive:true,filter:source=>source!=='public/resources'});
await mkdir('dist/images',{recursive:true});
for (const [to, from] of Object.entries(names)) {
 await access('public/resources/'+from);
 await copyFile('public/resources/'+from,'dist/images/'+to);
 const derivatives = to === 'aerial.jpg' ? [[640, 69], [1120, 65], [1280, 69], [1600, 61]] : [[640, 73], [1280, 76]];
 for (const [width, quality] of derivatives) {
   await sharp('public/resources/'+from).rotate().resize({ width, withoutEnlargement: true })
     .webp({ quality, effort: 5 }).toFile('dist/images/'+to.replace('.jpg', `-${width}.webp`));
 }
}
console.log('Troian 2027: static frontend, six villa photographs and independent Vercel API prepared.');
