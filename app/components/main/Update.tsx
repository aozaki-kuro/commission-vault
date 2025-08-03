import {
  getBaseFileName,
  isCharacterActive,
  kebabCase,
  mergePartsAndPreviews,
  parseAndFormatDate,
  sortCommissionsByDate,
} from '#components/utils'
import { commissionData } from '#data/commissionData'
import { Commission } from '#data/types'
import Link from 'next/link'

/**
 * 扩展 Commission 类型，添加 Character 属性。
 */
interface CommissionWithCharacter extends Commission {
  Character: string
}

/**
 * 使用 Set 去重并计算唯一的委托总数。
 * 对所有角色的委托作品进行去重处理，获取基础文件名，计算总数。
 */
const totalCommissions = new Set(
  commissionData.flatMap(({ Commissions }) =>
    Commissions.map(({ fileName }) => getBaseFileName(fileName)),
  ),
).size

/**
 * 获取活跃角色的最新委托作品列表。
 */
const latestEntries = commissionData
  // 过滤出活跃的角色
  .filter(({ Character }) => isCharacterActive(Character))
  // 展开每个角色的委托列表，并在每个委托对象中添加角色信息
  .flatMap(({ Character, Commissions }): CommissionWithCharacter[] =>
    Commissions.map(commission => ({ ...commission, Character })),
  )

/**
 * 使用 mergePartsAndPreviews 函数对委托作品进行去重处理，保留最新的版本。
 */
const uniqueEntries = mergePartsAndPreviews(latestEntries)

/**
 * 将委托作品按日期排序，并获取最近的三个条目。
 */
const sortedEntries = Array.from(uniqueEntries.values())
  .sort(sortCommissionsByDate)
  .slice(0, 3) as CommissionWithCharacter[] // 类型断言

/**
 * Update 组件显示最新的委托作品更新信息。
 */
const Update = () => {
  // 如果没有最新的委托作品，显示提示信息
  if (sortedEntries.length === 0) {
    return <p className="font-mono text-sm">No active updates found</p>
  }

  // 渲染最新的委托作品信息
  return (
    <div className="mt-6 mb-4 flex flex-col font-mono text-xs sm:text-sm md:mt-8">
      {/* 显示当前的委托总数 */}
      <p className="mb-2">Currently {totalCommissions} commissions</p>

      <div className="flex items-start">
        <p className="mr-2">Last update:</p>
        <div className="flex flex-col space-y-2">
          {/* 遍历最近的委托作品条目并渲染 */}
          {sortedEntries.map(({ fileName, Character }, index) => {
            // 提取日期部分（前8位）
            const commissionDate = fileName.substring(0, 8)
            // 格式化日期字符串
            const formattedDate = parseAndFormatDate(commissionDate, 'yyyy/MM/dd')
            // 生成链接的锚点 ID
            const linkId = `#${kebabCase(Character)}-${commissionDate}`

            return (
              <p key={index} className="mr-2">
                {/* 显示格式化日期并创建指向对应角色的链接 */}
                {formattedDate} {'[ '}
                <Link href={linkId} className="underline-offset-2">
                  {Character}
                </Link>
                {' ]'}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Update
