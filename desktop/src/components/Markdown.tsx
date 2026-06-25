import { type ReactNode } from 'react'

// Minimal markdown renderer (no deps): headings, bold/italic/code, bullet &
// numbered lists, paragraphs. Covers what the SOAP-note generator produces.

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/
  let remaining = text
  let key = 0
  while (remaining) {
    const m = regex.exec(remaining)
    if (!m) { nodes.push(remaining); break }
    if (m.index > 0) nodes.push(remaining.slice(0, m.index))
    if (m[2] !== undefined)       nodes.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] !== undefined)  nodes.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] !== undefined)  nodes.push(<code key={key++}>{m[4]}</code>)
    remaining = remaining.slice(m.index + m[0].length)
  }
  return nodes
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null
  let key = 0

  const flush = () => {
    if (!list.length) return
    blocks.push(
      listType === 'ol'
        ? <ol key={key++} className="md-ol">{list}</ol>
        : <ul key={key++} className="md-ul">{list}</ul>
    )
    list = []
    listType = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line)                    { flush(); continue }
    if (line.startsWith('### '))  { flush(); blocks.push(<h4 key={key++} className="md-h">{inline(line.slice(4))}</h4>); continue }
    if (line.startsWith('## '))   { flush(); blocks.push(<h3 key={key++} className="md-h">{inline(line.slice(3))}</h3>); continue }
    if (line.startsWith('# '))    { flush(); blocks.push(<h2 key={key++} className="md-h">{inline(line.slice(2))}</h2>); continue }

    const bullet = /^[-*•]\s+(.*)/.exec(line)
    if (bullet)   { if (listType !== 'ul') flush(); listType = 'ul'; list.push(<li key={key++}>{inline(bullet[1])}</li>); continue }

    const numbered = /^(\d+)\.\s+(.*)/.exec(line)
    if (numbered) { if (listType !== 'ol') flush(); listType = 'ol'; list.push(<li key={key++}>{inline(numbered[2])}</li>); continue }

    flush()
    blocks.push(<p key={key++} className="md-p">{inline(line)}</p>)
  }
  flush()

  return <div className="md">{blocks}</div>
}
