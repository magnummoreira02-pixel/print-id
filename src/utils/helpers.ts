export function normalize(v:any){
  return String(v??'').trim().toLowerCase()
}
export function cleanScan(raw:string, prefix:string, suffix:string){
  let s = raw.replace(/[\r\n\t\x00-\x1F]/g,'').trim()
  if(prefix && s.startsWith(prefix)) s=s.slice(prefix.length)
  if(suffix && s.endsWith(suffix)) s=s.slice(0, -suffix.length)
  return s.trim()
}
export function beep(ok:boolean){
  try{
    const ctx = new (window.AudioContext|| (window as any).webkitAudioContext)()
    const o = ctx.createOscillator(); const g=ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = ok? 880: 220
    g.gain.value=0.12
    o.start(); setTimeout(()=>{o.stop(); ctx.close()}, ok?120:400)
  }catch{}
}
