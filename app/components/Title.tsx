import { kebabCase } from '#lib/strings'
import Link from 'next/link'

type TitleProps = {
  Content: string
}

const Title = ({ Content }: TitleProps) => {
  return (
    <div id={`title-` + kebabCase(Content)} className="mb-2 pt-4">
      <h2 className="group relative">
        {Content}
        <Link
          href={`#${kebabCase(Content)}`}
          className="ml-2 font-bold text-gray-400 no-underline opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-gray-600"
        >
          #
        </Link>
      </h2>
    </div>
  )
}

export default Title
