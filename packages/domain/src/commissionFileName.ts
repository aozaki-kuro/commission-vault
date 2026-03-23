export interface CommissionFileNameParts {
  date: string
  year: string
  creator: string
}

export function parseCommissionFileName(fileName: string): CommissionFileNameParts {
  const date = fileName.slice(0, 8)
  const year = date.slice(0, 4)
  const creator = fileName.slice(9)
  return { date, year, creator }
}
