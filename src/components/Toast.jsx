import { CheckCircle2 } from 'lucide-react'

export default function Toast({ message }) {
  return message ? (
    <div className="toast" role="status">
      <CheckCircle2 size={18} />
      {message}
    </div>
  ) : null
}
