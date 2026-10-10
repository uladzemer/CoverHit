export class Progression {
  constructor(beaters, storage) {
    this.beaters=beaters; this.storage=storage; this.total=0; this.selected=beaters[0].id;
    try {
      this.storage = storage ?? globalThis.localStorage;
      storage = this.storage;
      this.total=Math.max(0,Math.floor(Number(storage.getItem('coverhit.carpetsTotal'))||0));
      const saved=storage.getItem('coverhit.beater');
      if(beaters.some(b=>b.id===saved && b.unlockCarpets<=this.total))this.selected=saved;
    } catch {}
  }
  select(id) {
    if(!this.beaters.some(b=>b.id===id && b.unlockCarpets<=this.total))return false;
    this.selected=id; try{this.storage.setItem('coverhit.beater',id);}catch{} return true;
  }
  completeCarpet() {
    const before=this.total++;
    try{this.storage.setItem('coverhit.carpetsTotal',String(this.total));}catch{}
    return this.beaters.filter(b=>b.unlockCarpets>before && b.unlockCarpets<=this.total);
  }
}
