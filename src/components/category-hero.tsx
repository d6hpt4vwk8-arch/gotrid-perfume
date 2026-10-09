import Image from "next/image";

/**
 * Category hero: a 3D product-render banner (made in Gemini from the shop's real packshots, same recipe as
 * the homepage hero) with the title + intro text laid over its dark left half. On phones the image sits on
 * top and the text underneath, so nothing covers the products.
 */
export function CategoryHero({
  title,
  paragraphs,
  image,
  alt,
}: {
  title: string;
  paragraphs: string[];
  image: string;
  alt: string;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-sm bg-[#131110] text-white sm:aspect-[2.36/1]">
      <div className="relative aspect-[2.36/1] w-full sm:absolute sm:inset-0 sm:aspect-auto">
        <Image src={image} alt={alt} fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover object-right" />
      </div>
      <div className="relative z-10 flex flex-col gap-3 px-6 pt-5 pb-8 sm:max-w-[48%] sm:px-8 sm:py-10 lg:max-w-[44%] lg:px-12 lg:py-14">
        <span aria-hidden className="h-px w-12 bg-[#d9a441]" />
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-white/80">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
