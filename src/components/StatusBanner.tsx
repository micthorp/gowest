interface Props {
  message: string | null
}

export function StatusBanner({ message }: Props) {
  if (!message) return null
  return (
    <div className="banner visible">
      ⚠ {message}
    </div>
  )
}
