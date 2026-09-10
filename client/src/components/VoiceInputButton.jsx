import { useRef, useState } from 'react'

export default function VoiceInputButton({
  value = '',
  onChange,
  className = '',
  buttonClassName = '',
  placeholder = 'Describe the issue in your own words...',
}) {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => {
      setError('')
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()

      if (!transcript) {
        return
      }

      const nextValue = value ? `${value.trim()} ${transcript}` : transcript
      onChange?.(nextValue)
    }

    recognition.onerror = () => {
      setIsListening(false)
      setError('Voice input failed. Please type manually.')
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={startListening}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isListening
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-emerald-50 text-primary hover:bg-emerald-100 dark:bg-slate-800 dark:text-emerald-300'
        } ${buttonClassName}`}
      >
        <span aria-hidden="true">{isListening ? '■' : '🎙'}</span>
        {isListening ? 'Listening...' : 'Voice'}
      </button>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {!value && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{placeholder}</p>
      )}
    </div>
  )
}