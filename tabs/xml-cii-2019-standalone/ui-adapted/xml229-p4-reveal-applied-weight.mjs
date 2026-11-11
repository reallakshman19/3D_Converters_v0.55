/**
 * Make the first populated draft kg input horizontally visible.
 * An input with a nonempty value can still be outside a wide table viewport.
 * This module never reads/writes an engineering approval or source mass.
 */
export function revealXml229PreparedWeightInput(table){
 const scroller=table?.querySelector?.('.mc-rigid-review-table-wrap');
 // A selected kg can become an accepted Worker Final during the render.
 // Reveal that same one editable Applied Weight input after source-wide apply.
 const input=scroller?.querySelector('tr[data-p4-draft-filled="true"] input[data-p4-applied-weight]')||
  scroller?.querySelector('tr[data-p4-stage="final"] input[data-p4-applied-weight]');
 if(!scroller||!input||input.value==='')return false;
 const viewport=scroller.getBoundingClientRect(),before=input.getBoundingClientRect();
 if(before.right>viewport.right)scroller.scrollLeft+=before.right-viewport.right+12;
 if(before.left<viewport.left)scroller.scrollLeft-=viewport.left-before.left+12;
 const after=input.getBoundingClientRect();
 return after.left>=viewport.left-1&&after.right<=viewport.right+1;
}
