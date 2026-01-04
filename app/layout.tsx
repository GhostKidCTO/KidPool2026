import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GhostKid SPL-404',
  description: 'Hybrid NFT-Token System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
