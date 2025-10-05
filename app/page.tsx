import type { NextPage } from 'next'

// Main content
import Commission from '#components/commission'
import CommissionDescription from '#components/main/Description'
import Footer from '#components/main/Footer'

// Sidebar
import CharacterList from '#components/main/CharacterList'

// Other components
import Hamburger from '#components/main/Hamburger'
import Warning from '#components/main/Warning'

const Home: NextPage = () => {
  return (
    <>
      <Warning />
      <div className="relative mx-auto flex justify-center">
        <div id="Main Contents" className="w-full max-w-[40rem]">
          <CommissionDescription />
          <Commission />
          <Footer />
        </div>
        <CharacterList />
      </div>
      <Hamburger />
    </>
  )
}

export default Home
