// Select a single visible feed video. Opening a modal pauses all feed playback.
export function createFeedPlayback(){
 const entries=new Map();let blocked=false,preferred=null
 function sync(){
  let selected=null,score=.4
  if(!blocked)for(const [id,row] of entries)if(row.ratio>score){selected=id;score=row.ratio}
  if(!blocked&&entries.get(preferred)?.ratio>.4)selected=preferred
  for(const [id,row] of entries)row.change(id===selected)
 }
 return {register(id,change){entries.set(id,{ratio:0,change});sync();return()=>{entries.delete(id);sync()}},update(id,ratio){const row=entries.get(id);if(row){row.ratio=ratio;sync()}},prefer(id){preferred=id;sync()},block(value){blocked=value;sync()}}
}
export const feedPlayback=createFeedPlayback()
