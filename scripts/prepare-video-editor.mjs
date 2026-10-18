import {copyFile,mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
export async function prepareVideoEditor(){
 const destination=new URL('../public/vendor/ffmpeg-0.12.10/',import.meta.url)
 await mkdir(destination,{recursive:true})
 for(const name of ['ffmpeg-core.js','ffmpeg-core.wasm']){
  try{await copyFile(new URL(`../node_modules/@ffmpeg/core/dist/esm/${name}`,import.meta.url),new URL(name,destination))}
  catch{throw new Error('Falta instalar o editor de vídeo. Execute npm.cmd ci na pasta do Itext e tente novamente.')}
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareVideoEditor()
