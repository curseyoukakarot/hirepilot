import { useEffect, useRef, useState } from 'react'

export function useTypewriter(full: string, speed = 18) {
  const [text, setText] = useState('')
  const i = useRef(0)
  useEffect(() => {
    setText('')
    i.current = 0
    const id = setInterval(() => {
      i.current += 1
      setText(full.slice(0, i.current))
      if (i.current >= full.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [full, speed])
  return text
}


