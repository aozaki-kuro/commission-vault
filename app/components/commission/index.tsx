import Listing from '#components/commission/Listing'
import { characterStatus } from '#data/commissionStatus'

const Commission = () => {
  const { active: activeChars, stale: staleChars } = characterStatus

  return (
    <div id="--------Commissions--------">
      {/* Display Active Commissions */}
      {activeChars.map(chara => (
        <Listing Character={chara.DisplayName} key={chara.DisplayName} />
      ))}

      {/* Divider between Active and Stale Commissions */}
      <div id="--------Stale Divder--------">
        <div className="pt-0" />
        <hr />
        <div className="pb-8" />
      </div>

      {/* Display Stale Commissions */}
      {staleChars.map(chara => (
        <Listing Character={chara.DisplayName} key={chara.DisplayName} />
      ))}
    </div>
  )
}

export default Commission
