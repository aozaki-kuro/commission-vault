'use client'
import { useState } from 'react'

interface CryptoAddressProps {
  currencyName: string
  address: string
}

const CryptoAddress = ({ currencyName, address }: CryptoAddressProps) => {
  const [showFeedback, setShowFeedback] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(address)
    setShowFeedback(true)
    setTimeout(() => setShowFeedback(false), 2000)
  }

  return (
    <li>
      <b>{currencyName}</b> {' - '}
      <span className="hidden cursor-pointer font-mono md:inline" onClick={copyToClipboard}>
        {address}
      </span>
      <p
        className="inline cursor-pointer text-gray-600 md:hidden dark:text-gray-200"
        onClick={copyToClipboard}
      >
        Click to copy
      </p>
      {showFeedback && (
        <span className="animate-fade-in-out ml-2.5 font-mono text-xs font-bold text-green-600 md:text-sm">
          Copied!
        </span>
      )}
    </li>
  )
}

export default CryptoAddress
