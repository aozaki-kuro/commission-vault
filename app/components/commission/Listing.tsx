import Title from '#components/Title'
import { commissionDataMap } from '#data/commissionData'
import { imageImports } from '#data/imageImports'
import { getCharacterSectionId } from '#lib/characters'
import { parseCommissionFileName } from '#lib/commissions'
import Image from 'next/image'
import IllustratorInfo from './IllustratorInfo'

type ListingProps = {
  Character: string
}

/**
 * Listing 组件显示特定角色的所有委托作品，包括图片、信息和链接。
 * @param Character - 角色名称。
 */
const Listing = ({ Character }: ListingProps) => {
  const sectionId = getCharacterSectionId(Character)
  const characterData = commissionDataMap.get(Character)
  const commissions = characterData?.Commissions ?? []

  return (
    <div id={sectionId}>
      {/* 显示角色标题 */}
      <Title Content={Character} />
      {/* 如果没有数据，显示占位文本，否则显示委托作品列表 */}
      {commissions.length === 0 ? (
        <p className="my-4">To be announced ...</p>
      ) : (
        commissions.map(commission => {
          const { date, year, creator } = parseCommissionFileName(commission.fileName)
          const altText = `Copyright ©️ ${year} ${creator || 'Anonymous'} & Crystallize`
          const imageSrc = imageImports[commission.fileName as keyof typeof imageImports]
          const elementId = `${sectionId}-${date}`

          return (
            <div key={commission.fileName} id={elementId} className="pt-4">
              {/* 如果有图片资源，显示图片 */}
              {imageSrc && (
                <Image
                  src={imageSrc}
                  alt={altText}
                  placeholder="blur"
                  className="pointer-events-none select-none"
                  loading="lazy"
                />
              )}
              {/* 显示委托作品的详细信息 */}
              <div className="mt-6 mb-2 md:mt-8 md:mb-4">
                <IllustratorInfo commission={commission} kebabName={sectionId} />
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
