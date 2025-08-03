import Link from 'next/link'

interface CreateLinksProps {
  links: string[]
  designLink?: string
}

/**
 * 对 URL 进行清理和标准化处理。
 * @param url 要清理的链接字符串
 * @returns 清理后的链接字符串（如将 x.com 替换为 twitter.com）
 */
const sanitizeUrl = (url: string): string => {
  if (url.includes('x.com')) {
    return url.replace('x.com', 'twitter.com')
  }
  return url
}

/**
 * 根据特定的优先级规则从给定链接数组中选择主要链接类型。
 * @param links 原始链接数组
 * @returns 根据优先级过滤和挑选后的主要链接数组，每个元素包含 type 和 url 字段
 */
const selectMainLinks = (links: string[]): { type: string; url: string }[] => {
  const mainLinkPriority = [
    { type: 'Twitter', patterns: ['twitter.com', 'x.com'] },
    { type: 'Pixiv', patterns: ['pixiv.net'] },
    { type: 'Nijie', patterns: ['nijie.info'] },
    { type: 'Fanbox', patterns: ['fanbox.cc'] },
    { type: 'Patreon', patterns: ['patreon.com'] },
    { type: 'Fantia', patterns: ['fantia.jp'] },
  ]

  const selectedLinks: { type: string; url: string }[] = []

  for (const priority of mainLinkPriority) {
    // 从 links 中查找符合当前优先级模式的第一个链接
    const foundLink = links.find(link => priority.patterns.some(pattern => link.includes(pattern)))

    // 如果找到符合当前优先级的链接，并且之前还没有选过该类型，则加入 selectedLinks
    if (foundLink && !selectedLinks.some(selected => selected.type === priority.type)) {
      selectedLinks.push({ type: priority.type, url: sanitizeUrl(foundLink) })
    }
  }

  return selectedLinks
}

/**
 * 根据提供的链接数组和可选 designLink 生成链接的 React 元素数组。
 *
 * 功能与规则：
 * 1. 优先从 links 中选取主要链接（Twitter、Pixiv、Patreon等），最多取3个。
 *    如果有 designLink，则主要链接的数量限制为2个（因为需要给 designLink 预留一个名额）。
 * 2. 渲染时，第一个链接不加左边距，后续链接通过添加 `ml-2 md:ml-3` 来分隔。
 * 3. 如果没有任何链接匹配（mainLinks为空且无designLink），则返回 'N/A'。
 * 4. 设计链接（Design）如果存在，始终在最后显示，并同样根据是否为第一个显示的链接决定是否添加间距。
 */
export const createLinks = ({ links, designLink }: CreateLinksProps) => {
  const hasDesign = Boolean(designLink)
  const mainLinks = selectMainLinks(links)

  // 最大显示链接总数为3，如果有 designLink 则主要链接数量最多2个
  const maxLinks = 3
  const maxMainLinks = hasDesign ? maxLinks - 1 : maxLinks

  // 只保留限定数量的主要链接
  const limitedMainLinks = mainLinks.slice(0, maxMainLinks)

  // 将主要链接映射为 React 元素。
  // 如果是第一个链接，不加 ml- 类。否则在类名中添加 'ml-2 md:ml-3' 来分隔链接。
  const mainLinkElements = limitedMainLinks.map((link, index) => {
    const marginClass = index > 0 ? 'ml-2 md:ml-3' : ''
    return (
      <span key={`${link.type}-${index}`} className={marginClass}>
        <Link href={link.url} className="underline-offset-2 select-none" target="_blank">
          {link.type}
        </Link>
      </span>
    )
  })

  // 如果有 designLink，需要根据当前已有链接数量决定是否加间距
  const designLinkElement = hasDesign ? (
    <span key="Design" className={mainLinkElements.length > 0 ? 'ml-2 md:ml-3' : ''}>
      <Link
        href={sanitizeUrl(designLink!)}
        className="underline-offset-2 select-none"
        target="_blank"
      >
        Design
      </Link>
    </span>
  ) : null

  // 将主要链接和 designLink 合并
  const combinedLinks = designLinkElement
    ? [...mainLinkElements, designLinkElement]
    : mainLinkElements

  // 如果没有任何链接显示，则返回 'N/A'
  if (combinedLinks.length === 0) {
    return [<span key="error">N/A</span>]
  }

  return combinedLinks
}
