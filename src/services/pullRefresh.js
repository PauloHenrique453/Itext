export const PULL_THRESHOLD=64
export function createPullRefresh({canStart=()=>true,refresh,onChange=()=>{},onError=()=>{}}){
 let start=null,busy=false,disposed=false,state={phase:'idle',distance:0}
 function update(phase,distance=0){state={phase,distance};if(!disposed)onChange(state)}
 function cancel(){start=null;if(!busy)update('idle')}
 async function run(){
  if(busy||disposed)return
  start=null;busy=true;update('refreshing',PULL_THRESHOLD)
  try{await refresh()}catch(issue){if(!disposed)onError(issue)}finally{busy=false;update('idle')}
 }
 return {
  begin(x,y,eligible=true){start=null;if(busy||disposed||!eligible||!canStart())return;start={x,y,locked:false}},
  move(x,y){
   if(!start||busy||disposed)return false
   if(!canStart()){cancel();return false}
   const dx=Math.abs(x-start.x),dy=y-start.y
   if(!start.locked){if(dx>8&&dx>Math.abs(dy)){cancel();return false}if(dy<=8)return false;if(dy<dx*1.2)return false;start.locked=true}
   const distance=Math.min(100,Math.max(0,dy*.55));update(distance>=PULL_THRESHOLD?'ready':'pulling',distance);return true
  },
  end(){const ready=state.phase==='ready';start=null;return ready?run():cancel()},
  cancel,refresh:run,snapshot:()=>state,dispose(){disposed=true;start=null},
 }
}
