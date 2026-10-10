import {describe,it,expect} from 'vitest';
import {pageIndex,modalKey,paginate} from '../src/ui/modal.js';
describe('modal paging and keyboard policy',()=>{
 it('bounds pages without wrapping or accepting invalid indices',()=>{expect(pageIndex(-2,4)).toBe(0);expect(pageIndex(10,4)).toBe(3);expect(pageIndex(NaN,0)).toBe(0);});
 it('pages with arrows, activates with Enter, and backs out with Escape',()=>{expect(modalKey('ArrowRight',2,4)).toEqual({action:'page',index:3});expect(modalKey('ArrowLeft',0,4).index).toBe(0);expect(modalKey('Enter',2,4).action).toBe('primary');expect(modalKey('Escape',2,4)).toEqual({action:'back',index:1});expect(modalKey('Escape',0,4).action).toBe('close');});
 it('leaves native slider/select keyboard interaction intact',()=>{for(const key of ['ArrowLeft','ArrowRight','Enter'])expect(modalKey(key,1,4,true)).toBeNull();expect(modalKey('Escape',1,4,true).action).toBe('back');});
 it('paginates all credits without dropping or repeating entries',()=>{const items=Array.from({length:13},(_,i)=>i);const pages=paginate(items,4);expect(pages.map(p=>p.length)).toEqual([4,4,4,1]);expect(pages.flat()).toEqual(items);expect(paginate([])).toEqual([[]]);expect(paginate([1,2],0)).toEqual([[1],[2]]);});
});
