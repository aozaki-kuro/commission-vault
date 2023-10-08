import Link from 'next/link'

const Footer = () => {
  return (
    <>
      <div className="pt-4" />
      <hr />
      <div className="pb-8" />
      <div className="pb-10 text-center text-xs">
        <p className="pt-2">
          規約による、Skeb でやり取りされた作品のすべての権利はクリエイターと版権元に帰属する。
        </p>
        <p className="pt-2">
          The copyright of all art works commissioned on Skeb belongs to the artist and the proper
          copyright holders.
        </p>
        <p className="pt-2">Some character names are obscured due to rule requirements.</p>
        <p className="pt-2">This site has restricted search engines from indexing.</p>
      </div>

      <small className="block pt-24 text-p-light dark:text-gray-300">
        <time>2022 - {new Date().getFullYear()}</time> © Crystallize
        <div className="float-right">
          <Link
            href="mailto:dmca@crystallize.eu.org"
            className="decoration-inherit decoration-dotted dark:text-gray-300"
          >
            DMCA
          </Link>
        </div>
      </small>
    </>
  )
}

export default Footer
