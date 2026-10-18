/* Small (?) clues next to important fields/buttons. One shared tooltip,
   positioned next to whichever .help-icon was clicked. Vanilla JS, no deps. */
(function(){
  "use strict";
  const tip=document.createElement("div");
  tip.className="help-tip";
  tip.setAttribute("role","tooltip");
  tip.hidden=true;
  document.body.appendChild(tip);
  let current=null;

  function hide(){
    tip.hidden=true;
    if(current)current.setAttribute("aria-expanded","false");
    current=null;
  }

  function show(btn){
    if(current===btn){hide();return}
    current=btn;
    tip.textContent=btn.dataset.help||"";
    tip.hidden=false;
    btn.setAttribute("aria-expanded","true");
    const r=btn.getBoundingClientRect();
    const tr=tip.getBoundingClientRect();
    let left=r.left+window.scrollX;
    const maxLeft=window.scrollX+document.documentElement.clientWidth-tr.width-12;
    if(left>maxLeft)left=Math.max(12,maxLeft);
    tip.style.left=left+"px";
    tip.style.top=(r.bottom+window.scrollY+8)+"px";
  }

  document.addEventListener("click",e=>{
    const btn=e.target.closest(".help-icon");
    if(btn){e.preventDefault();e.stopPropagation();show(btn);return}
    if(!e.target.closest(".help-tip"))hide();
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
  window.addEventListener("resize",hide);
  window.addEventListener("scroll",hide,true);
})();
