export default function Avatar({ user, size = 'md', className = '' }) {
  const sizeClass = `avatar-${size}`
  if (user?.profile_image) {
    return <img src={user.profile_image} alt={user.username} className={`avatar ${sizeClass} ${className}`} />
  }
  const letter = (user?.display_name || user?.username || '?')[0].toUpperCase()
  return (
    <div className={`avatar avatar-placeholder ${sizeClass} ${className}`}>
      {letter}
    </div>
  )
}
