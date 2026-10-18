import * as React from 'react';
import {createRoot} from 'react-dom/client';
import RangoliPreloader, {rgpBuild} from '../components/ui/rangoli-preloader';

function RangoliArt(){
 const ref=React.useRef<HTMLCanvasElement>(null);
 React.useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  const colors=['#b5a58d','#bf6948','#dfa64f','#d5ad62','#965543','#566549','#7d896b'];
  const grains=rgpBuild(8,14000,7);ctx.clearRect(0,0,640,640);
  for(let i=0;i<grains.count;i++){ctx.globalAlpha=grains.shade[i]*.8;ctx.fillStyle=colors[grains.slot[i]];const size=1.8*grains.size[i];ctx.fillRect(320+grains.xs[i]*295,320+grains.ys[i]*295,size,size)}
 },[]);
 return <div className="welcome-art" aria-hidden="true"><div className="art-halo"/><canvas ref={ref} width="640" height="640"/><img src="/assets/kriti-logo.jpeg" alt="" className="art-logo"/><span className="art-note">Rooted in craft. Ready for the world.</span></div>;
}
function Welcome(){
 const [intro,setIntro]=React.useState(true);
 const heading=React.useRef<HTMLHeadingElement>(null);
 const finish=React.useCallback(()=>{setIntro(false);requestAnimationFrame(()=>heading.current?.focus())},[]);
 return <>
  <div className="welcome-page" inert={intro}>
   <header className="welcome-nav"><a href="/" className="welcome-brand" aria-label="Kriti home"><img src="/assets/kriti-logo.jpeg" alt="Kriti logo" width="56" height="56"/><span>Kriti<span className="brand-sub">MADE FOR YOUR BUSINESS</span></span></a><a className="welcome-signin" href="/index.html">Enter your studio <span aria-hidden="true">↗</span></a></header>
   <main id="welcome-main">
    <section className="welcome-hero"><div className="welcome-copy"><p className="eyebrow"><span/> A NEW BEGINNING FOR YOUR BUSINESS</p><h1 ref={heading} tabIndex={-1}>Welcome<br/>to <em>Kriti.</em></h1><p className="welcome-description">You make something special.<br/>Let’s help the world discover it.</p><p className="welcome-detail">Turn a product photo into a thoughtful catalog and marketing in your language. Your story, your price, your final say.</p><a className="welcome-cta" href="/index.html">Start creating <span aria-hidden="true">↗</span></a><p className="welcome-caption">Made for independent makers & small merchants.</p></div><RangoliArt/></section>
    <section className="welcome-steps" aria-label="How Kriti works">{[['01','Capture your craft','Start with a clear product photo.'],['02','Make it yours','Review the details and set your price.'],['03','Tell your story','Create a catalog and marketing drafts.']].map(([n,title,body])=><article key={n}><span className="step-number">{n}</span><div><h2>{title}</h2><p>{body}</p></div></article>)}</section>
   </main><footer className="welcome-footer"><span>Thoughtfully made. Authentically yours.</span><span>कृति · Creation</span></footer>
  </div>
  {intro&&<div className="welcome-intro"><RangoliPreloader durationMs={4200} waitForInteraction preset="oxide" hud={false} meta="Kriti" label="Welcome animation" message="Welcome to Kriti." blessing="शुभ आरंभ" onComplete={finish}/></div>}
 </>;
}
// Preserve email confirmation/recovery links that previously returned to the root URL.
if(location.hash.includes('access_token=')||location.hash.includes('error=')||new URLSearchParams(location.search).has('code'))location.replace('/index.html'+location.search+location.hash);
else createRoot(document.getElementById('welcome-root')!).render(<Welcome/>);
