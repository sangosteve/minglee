// frontend/src/lib/keyword-matcher.ts
export interface KeywordMatchOptions {
  keywords: string[]
  caseSensitive: boolean
  matchAll: boolean
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith'
}

export function checkKeywordMatch(
  message: string,
  options: KeywordMatchOptions
): boolean {
  const { keywords, caseSensitive, matchAll, matchType } = options
  
  if (keywords.length === 0) return false
  
  const normalizedMessage = caseSensitive ? message : message.toLowerCase()
  
  const matches = keywords.map(keyword => {
    const normalizedKeyword = caseSensitive ? keyword : keyword.toLowerCase()
    
    switch (matchType) {
      case 'exact':
        return normalizedMessage === normalizedKeyword
      case 'contains':
        return normalizedMessage.includes(normalizedKeyword)
      case 'startsWith':
        return normalizedMessage.startsWith(normalizedKeyword)
      case 'endsWith':
        return normalizedMessage.endsWith(normalizedKeyword)
      default:
        return normalizedMessage.includes(normalizedKeyword)
    }
  })
  
  // AND logic (matchAll = true) vs OR logic (matchAll = false)
  return matchAll 
    ? matches.every(match => match === true)
    : matches.some(match => match === true)
}