// Route large videos before invoking the upload API, which correctly caps files at 50 MB.
export async function addComposerFiles(files,{forceVideoEdit=false,edit,upload,onUploaded}){
 const video=files.find(file=>file.type?.startsWith('video/')&&(forceVideoEdit||file.size>50000000))
 if(video){edit(video,files.length>1);return}
 for(const file of files){const saved=await upload(file);onUploaded(saved.media)}
}
