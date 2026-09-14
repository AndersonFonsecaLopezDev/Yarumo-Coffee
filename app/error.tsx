'use client'
export default function Error({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main style={{padding:'80px',fontFamily:'Arial'}}><h1>Algo salió mal</h1><p>No pudimos cargar Yarumo en este momento.</p><button onClick={reset}>Intentar de nuevo</button></main>}
