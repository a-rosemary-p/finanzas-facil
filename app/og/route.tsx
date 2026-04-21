import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)',
          fontFamily: 'sans-serif',
          gap: '24px',
        }}
      >
        {/* Logo box */}
        <div
          style={{
            background: '#578466',
            borderRadius: '28px',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '52px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-2px',
          }}
        >
          FF
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: '#578466',
            letterSpacing: '-1px',
          }}
        >
          FinanzasFácil
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '32px',
            color: '#6B8C78',
            fontWeight: 400,
          }}
        >
          Control de finanzas para tu negocio
        </div>

        {/* URL pill */}
        <div
          style={{
            marginTop: '8px',
            background: '#fff',
            borderRadius: '999px',
            padding: '10px 28px',
            fontSize: '24px',
            color: '#578466',
            fontWeight: 600,
          }}
        >
          finanzasfacil.mx
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
