import './globals.css'

export const metadata = {
  title: 'ShiftBoard',
  description: 'Gestion des horaires de votre équipe',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
