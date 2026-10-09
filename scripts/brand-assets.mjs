import sharp from "sharp";
const src = "public/brand/logo-original.jpg";
const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
console.log(info);
// couleur de fond moyenne (coin)
let bg=[0,0,0]; for(let y=0;y<20;y++)for(let x=0;x<20;x++){const i=(y*info.width+x)*info.channels;bg[0]+=data[i];bg[1]+=data[i+1];bg[2]+=data[i+2];}
bg=bg.map(v=>v/400); console.log("bg",bg.map(Math.round));
const out = Buffer.alloc(info.width*info.height*4);
for (let p=0;p<info.width*info.height;p++){
  const i=p*info.channels, r=data[i],g=data[i+1],b=data[i+2];
  const d=Math.max(r-bg[0],g-bg[1],b-bg[2]);
  let a=Math.min(1,Math.max(0,(d-18)/(150-18)));
  const o=p*4;
  if(a<=0){out[o+3]=0;continue;}
  out[o]=Math.min(255,Math.max(0,(r-bg[0]*(1-a))/a));
  out[o+1]=Math.min(255,Math.max(0,(g-bg[1]*(1-a))/a));
  out[o+2]=Math.min(255,Math.max(0,(b-bg[2]*(1-a))/a));
  out[o+3]=Math.round(a*255);
}
const base = () => sharp(out,{raw:{width:info.width,height:info.height,channels:4}});
const crop = async (name, box) => {
  const buf = await base().extract(box).png().toBuffer();
  await sharp(buf).trim({threshold:1}).png({compressionLevel:9}).toFile(`public/brand/${name}.png`);
  const m = await sharp(`public/brand/${name}.png`).metadata(); console.log(name, m.width, m.height);
};
await crop("logo-full", {left:0,top:0,width:info.width,height:info.height});
await crop("emblem", {left:200,top:100,width:850,height:740});
await crop("monogram", {left:340,top:140,width:580,height:660});
await crop("wordmark", {left:150,top:850,width:950,height:300});
// icônes d'app : monogramme doré sur fond nuit
const mono = await sharp("public/brand/monogram.png").resize(330,330,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).toBuffer();
const navy = {r:Math.round(bg[0]),g:Math.round(bg[1]),b:Math.round(bg[2]),alpha:1};
await sharp({create:{width:512,height:512,channels:4,background:navy}}).composite([{input:mono,gravity:"center"}]).png().toFile("src/app/icon.png");
await sharp("src/app/icon.png").resize(180,180).png().toFile("src/app/apple-icon.png");
console.log("done");
