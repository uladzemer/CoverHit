export function createStrikeLog({dev=false,search=''} = {}) {
  if(!dev && !new URLSearchParams(search).has('debug')) return null;
  const entries=[];
  let previous;
  const append=entry=>{
    entries.push(entry);
    if(entries.length>32) entries.shift();
  };
  return {
    entries,
    hit(entry) {
      append({...entry,interval:previous ? entry.time-previous.time : null,
        wallInterval:previous ? entry.wall-previous.wall : null});
      previous=entry;
    },
    miss(time) {append({time,miss:true});},
  };
}
