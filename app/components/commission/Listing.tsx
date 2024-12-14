'use client'

import Title from '#components/Title'
import { kebabCase } from '#components/utils'
import { commissionData } from '#data/commissionData'
import { imageImports } from '#data/imageImports'
import Image from 'next/image'
import { useEffect } from 'react'
import IllustratorInfo from './IllustratorInfo'

/**
 * 自定义滚动钩子，用于处理页面滚动时的哈希值更新。
 */
const useScrollHook = () => {
  useEffect(() => {
    const handleScroll = () => {
      // 如果 URL 中有哈希值
      if (window.location.hash) {
        const element = document.querySelector(window.location.hash)
        if (element) {
          const rect = element.getBoundingClientRect()
          // 如果元素不在视口内，清除哈希值
          if (rect.bottom < 0 || rect.top > window.innerHeight) {
            history.replaceState(null, '', ' ')
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])
}

type ListingProps = {
  Character: string
}

/**
 * Listing 组件显示特定角色的所有委托作品，包括图片、信息和链接。
 * @param Character - 角色名称。
 */
const Listing = ({ Character }: ListingProps) => {
  // 使用自定义滚动钩子
  useScrollHook()

  // 查找与给定角色相关的数据
  const characterData = commissionData.find(data => data.Character === Character)

  // 对委托作品进行排序（按日期降序），并过滤出隐藏的作品
  const sortedCommissions = [...(characterData?.Commissions || [])].sort((a, b) => {
    const dateA = Number(a.fileName.slice(0, 8))
    const dateB = Number(b.fileName.slice(0, 8))
    return dateB - dateA
  })

  return (
    <div id={kebabCase(Character)}>
      {/* 显示角色标题 */}
      <Title Content={Character} />

      {/* 如果没有数据，显示占位文本，否则显示委托作品列表 */}
      {!characterData || sortedCommissions.length === 0 ? (
        <p className="my-4">To be announced ...</p>
      ) : (
        sortedCommissions.map((commission, index) => {
          // 从文件名中提取日期和创作者信息
          const fileName = commission.fileName
          const illustYear = fileName.slice(0, 4)
          const illustDate = fileName.slice(0, 8)
          const creatorName = fileName.slice(9) || 'Anonymous'

          // 生成图片的替代文本
          const altText = `Copyright ©️ ${illustYear} ${creatorName} & Crystallize`

          // 获取对应的图片资源
          const imageSrc = imageImports[fileName as keyof typeof imageImports]

          // 生成元素的锚点 ID
          const elementId = `${kebabCase(Character)}-${illustDate}`

          return (
            <div key={index} id={elementId} className="pt-4">
              {/* 如果有图片资源，显示图片 */}
              {imageSrc && (
                <Image
                  src={imageSrc}
                  alt={altText}
                  width={1280}
                  height={525}
                  placeholder="blur"
                  className="pointer-events-none select-none"
                  loading="lazy"
                />
              )}
              {/* 显示委托作品的详细信息 */}
              <div className="mb-4 mt-8 md:mb-2 md:mt-6">
                <IllustratorInfo commission={commission} characterName={Character} />
              </div>
            </div>
          )
        })
      )}
      <div className="pb-6" />
    </div>
  )
}

export default Listing
