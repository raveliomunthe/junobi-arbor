export default function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-bold text-[#b3261e]">
      {message}
    </p>
  )
}
