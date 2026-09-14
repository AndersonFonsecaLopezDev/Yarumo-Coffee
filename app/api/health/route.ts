import { NextResponse } from 'next/server'
export function GET(){return NextResponse.json({ok:true,service:'yarumo-coffee',timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}
